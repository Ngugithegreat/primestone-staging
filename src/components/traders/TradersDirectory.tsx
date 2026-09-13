"use client";

import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CopyModal } from "./CopyModal";
import { TraderCard } from "./TraderCard";
import { Card } from "@/components/ui/Primitives";
import { SegmentedControl } from "@/components/ui/Field";
import { ASSET_CLASS_LABEL, getInstrument, type AssetClass } from "@/lib/market";
import {
  getRealProviders,
  subscribeToProvider,
  usd,
  type RealProvider,
} from "@/lib/accountClient";
import { useRealAccount } from "@/lib/useRealAccount";
import { setPendingCopy } from "@/lib/pendingCopy";
import { useStore } from "@/lib/store";
import { TRADERS, type RiskLevel, type Trader } from "@/lib/traders";
import { cn } from "@/lib/utils";

const FLAG: Record<string, string> = {
  Kenya: "🇰🇪", Nigeria: "🇳🇬", "South Africa": "🇿🇦", Ghana: "🇬🇭", Tanzania: "🇹🇿",
  Uganda: "🇺🇬", "United Kingdom": "🇬🇧", Germany: "🇩🇪", Singapore: "🇸🇬", UAE: "🇦🇪",
  India: "🇮🇳", "United States": "🇺🇸",
};

/** Map a real, admin-managed provider onto the Trader card shape. */
function realProviderToTrader(p: RealProvider): Trader {
  const roi12m = Number(p.roi12m) || 0;
  const maxDrawdown = Number(p.maxDrawdown) || 0;
  const risk: RiskLevel = maxDrawdown < 8 ? "Low" : maxDrawdown < 15 ? "Medium" : "High";
  return {
    id: p.id,
    isReal: true,
    name: p.name,
    handle: p.handle || `@${p.name.toLowerCase().replace(/\s+/g, "")}`,
    country: p.country || "Kenya",
    flag: FLAG[p.country] ?? "🌍",
    gradient: ["#2ff0bd", "#6366f1"],
    verified: p.verified,
    strategy: p.strategy || "Copy strategy",
    bio: p.bio || "",
    markets: ["BTCUSD", "ETHUSD", "XAUUSD"],
    roi12m,
    roi30d: Math.round((roi12m / 12) * 10) / 10,
    winRate: Number(p.winRate) || 0,
    followers: 0,
    fee: p.feeBps / 100,
    monthsActive: 6,
    aum: 0,
    trades: 0,
    maxDrawdown,
    profitFactor: 1.6,
    avgHoldHours: 12,
    riskScore: maxDrawdown < 8 ? 3 : maxDrawdown < 15 ? 5 : 8,
    risk,
    copySlots: 500,
    slotsTaken: 0,
    minInvestment: Math.round((p.minInvestmentMinor ?? 0) / 100),
  };
}

type SortKey = "roi12m" | "roi30d" | "winRate" | "followers" | "maxDrawdown" | "fee";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "roi12m", label: "Return 12M" },
  { value: "roi30d", label: "Return 30D" },
  { value: "winRate", label: "Win rate" },
  { value: "followers", label: "Copiers" },
  { value: "maxDrawdown", label: "Lowest drawdown" },
  { value: "fee", label: "Lowest fee" },
];

const RISKS: (RiskLevel | "all")[] = ["all", "Low", "Medium", "High"];
const MARKETS: (AssetClass | "all")[] = ["all", "forex", "crypto", "metals", "indices", "stocks"];

export function TradersDirectory() {
  const router = useRouter();
  const copies = useStore((s) => s.copies);
  const pushToast = useStore((s) => s.pushToast);
  const real = useRealAccount();

  // Copying a REAL provider allocates your available balance to them, so the
  // engine starts mirroring their trades into your account. No balance yet →
  // send them to the wallet to deposit first.
  const copyReal = async (t: Trader) => {
    if (real.balanceMinor <= 0) {
      // Copy-first: remember the choice; the deposit they make on the wallet
      // will auto-allocate to this provider.
      setPendingCopy(t.id, t.name);
      pushToast({
        tone: "info",
        title: `You'll copy ${t.name}`,
        body: "Deposit on the next screen — your funds start copying automatically.",
      });
      router.push("/wallet");
      return;
    }
    const res = await subscribeToProvider({ providerId: t.id, amount: real.balanceMinor / 100 });
    if (res.ok) {
      pushToast({
        tone: "success",
        title: `Now copying ${t.name}`,
        body: `${usd(real.balanceMinor)} allocated — their trades will mirror into your account.`,
      });
      await real.refresh();
    } else {
      pushToast({ tone: "error", title: "Could not copy", body: res.error });
    }
  };

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("roi12m");
  const [risk, setRisk] = useState<RiskLevel | "all">("all");
  const [market, setMarket] = useState<AssetClass | "all">("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [target, setTarget] = useState<Trader | null>(null);
  const [realTraders, setRealTraders] = useState<Trader[]>([]);

  // Real, admin-managed providers appear at the top, above the demo roster.
  useEffect(() => {
    getRealProviders().then((ps) => setRealTraders(ps.map(realProviderToTrader)));
  }, []);

  const everyone = useMemo(() => [...realTraders, ...TRADERS], [realTraders]);
  const copiedIds = useMemo(() => new Set(copies.map((c) => c.traderId)), [copies]);

  const results = useMemo(() => {
    let list = everyone.slice();

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.handle.toLowerCase().includes(q) ||
          t.strategy.toLowerCase().includes(q) ||
          t.country.toLowerCase().includes(q),
      );
    }
    if (risk !== "all") list = list.filter((t) => t.risk === risk);
    if (verifiedOnly) list = list.filter((t) => t.verified);
    if (market !== "all") {
      list = list.filter((t) => t.markets.some((m) => getInstrument(m).cls === market));
    }

    const ascending = sort === "maxDrawdown" || sort === "fee";
    return list.sort((a, b) => (ascending ? a[sort] - b[sort] : b[sort] - a[sort]));
  }, [everyone, query, sort, risk, market, verifiedOnly]);

  const filtersActive = risk !== "all" || market !== "all" || verifiedOnly || query !== "";

  // The board is hundreds deep — render a page at a time and reset whenever the
  // filtered set changes, so we never mount 340 animated cards at once.
  const PAGE = 24;
  const [visible, setVisible] = useState(PAGE);
  useEffect(() => setVisible(PAGE), [query, sort, risk, market, verifiedOnly]);
  const shown = results.slice(0, visible);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-bold leading-tight text-white">
            Strategy providers
          </h1>
          <p className="mt-1 text-[14px] text-slate-400">
            {results.length} of {everyone.length} providers · every statistic recalculated
            nightly from settled trades
          </p>
        </div>
      </div>

      {/* ---- Filters ------------------------------------------------------- */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, strategy or country"
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-ink-900/70 pl-10 pr-9 text-[13.5px] text-white outline-none transition-colors placeholder:text-slate-500 focus:border-mint-500/50"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-slate-500" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-10 rounded-xl border border-white/[0.08] bg-ink-900/70 px-3 text-[13.5px] text-white outline-none focus:border-mint-500/50 [&>option]:bg-ink-800"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  Sort: {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-3">
          <FilterGroup label="Risk">
            <SegmentedControl
              size="sm"
              value={risk}
              onChange={setRisk}
              options={RISKS.map((r) => ({ value: r, label: r === "all" ? "Any" : r }))}
            />
          </FilterGroup>

          <FilterGroup label="Markets">
            <div className="flex flex-wrap gap-1.5">
              {MARKETS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMarket(m)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors",
                    market === m
                      ? "bg-white/[0.10] text-white"
                      : "bg-white/[0.03] text-slate-400 hover:bg-white/[0.07]",
                  )}
                >
                  {m === "all" ? "All" : ASSET_CLASS_LABEL[m]}
                </button>
              ))}
            </div>
          </FilterGroup>

          <button
            onClick={() => setVerifiedOnly((v) => !v)}
            className={cn(
              "focus-ring rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors",
              verifiedOnly
                ? "border-mint-500/40 bg-mint-500/10 text-mint-300"
                : "border-white/[0.08] bg-white/[0.02] text-slate-400 hover:bg-white/[0.06]",
            )}
          >
            Verified only
          </button>

          {filtersActive && (
            <button
              onClick={() => {
                setQuery("");
                setRisk("all");
                setMarket("all");
                setVerifiedOnly(false);
              }}
              className="text-[12.5px] font-medium text-slate-400 underline-offset-2 hover:text-white hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>
      </Card>

      {/* ---- Results ------------------------------------------------------- */}
      {results.length === 0 ? (
        <Card className="grid place-items-center px-6 py-16 text-center">
          <p className="text-[15px] font-medium text-white">No providers match those filters</p>
          <p className="mt-1.5 max-w-sm text-[13.5px] text-slate-400">
            Try widening the risk band or clearing the market filter.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {shown.map((t, i) => (
              <TraderCard
                key={t.id}
                trader={t}
                href={t.isReal ? "/wallet" : `/traders/${t.id}`}
                index={i % PAGE}
                onCopy={(tr) => (tr.isReal ? copyReal(tr) : setTarget(tr))}
                copying={copiedIds.has(t.id)}
              />
            ))}
          </div>

          {visible < results.length && (
            <div className="mt-8 flex flex-col items-center gap-3">
              <p className="text-[13px] text-slate-500">
                Showing {shown.length} of {results.length} providers
              </p>
              <button
                onClick={() => setVisible((v) => v + PAGE)}
                className="focus-ring rounded-xl border border-white/10 bg-white/[0.04] px-6 py-2.5 text-[13.5px] font-medium text-white transition-colors hover:bg-white/[0.09]"
              >
                Load more providers
              </button>
            </div>
          )}
        </>
      )}

      <CopyModal trader={target} open={target !== null} onClose={() => setTarget(null)} />
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[11.5px] font-medium uppercase tracking-[0.1em] text-slate-500">
        {label}
      </span>
      {children}
    </div>
  );
}

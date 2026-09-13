export type AccountTypeId = "standard" | "ecn" | "pro" | "swap-free";

export type AccountType = {
  id: AccountTypeId;
  name: string;
  tagline: string;
  /** Multiplier applied to the raw instrument spread. */
  spreadMultiplier: number;
  spreadLabel: string;
  commissionLabel: string;
  /** Round-turn commission per lot, in account currency. */
  commissionPerLot: number;
  minDeposit: number;
  maxLeverage: number;
  demoCredit: number;
  popular?: boolean;
  accent: [string, string];
  features: string[];
  bestFor: string;
};

export const ACCOUNT_TYPES: AccountType[] = [
  {
    id: "standard",
    name: "Standard",
    tagline: "Everything you need to start copying, with nothing to pay up front.",
    spreadMultiplier: 1,
    spreadLabel: "from 1.0 pip",
    commissionLabel: "Zero commission",
    commissionPerLot: 0,
    minDeposit: 50,
    maxLeverage: 500,
    demoCredit: 10_000,
    accent: ["#00dfa4", "#0ea5e9"],
    popular: true,
    features: [
      "Copy up to 5 strategy providers",
      "All 18 instruments unlocked",
      "Market execution, no dealing desk",
      "Free deposits via M-Pesa, card and crypto",
      "$10,000 demo credit on signup",
    ],
    bestFor: "First-time copiers and anyone funding under $2,000.",
  },
  {
    id: "ecn",
    name: "ECN",
    tagline: "Raw interbank pricing with a flat commission — the desk standard.",
    spreadMultiplier: 0.35,
    spreadLabel: "from 0.0 pips",
    commissionLabel: "$3.50 per lot per side",
    commissionPerLot: 7,
    minDeposit: 500,
    maxLeverage: 400,
    demoCredit: 25_000,
    accent: ["#818cf8", "#c084fc"],
    features: [
      "Raw spreads straight from 12 liquidity providers",
      "Copy up to 20 strategy providers",
      "Sub-14ms average execution",
      "Depth-of-market and limit-order book access",
      "$25,000 demo credit on signup",
    ],
    bestFor: "Active traders and scalpers who pay for tighter pricing.",
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Institutional pricing, a named manager and priority everything.",
    spreadMultiplier: 0.2,
    spreadLabel: "from 0.0 pips",
    commissionLabel: "$2.00 per lot per side",
    commissionPerLot: 4,
    minDeposit: 5_000,
    maxLeverage: 200,
    demoCredit: 100_000,
    accent: ["#fbbf24", "#f97316"],
    features: [
      "Best-available pricing across the full LP pool",
      "Unlimited copy allocations",
      "Dedicated account manager and priority withdrawals",
      "VPS hosting and full REST + FIX API access",
      "$100,000 demo credit on signup",
    ],
    bestFor: "High-volume accounts and small funds allocating six figures.",
  },
  {
    id: "swap-free",
    name: "Swap-Free",
    tagline: "Shariah-compliant. No overnight interest on any position, ever.",
    spreadMultiplier: 1.15,
    spreadLabel: "from 1.2 pips",
    commissionLabel: "Zero commission",
    commissionPerLot: 0,
    minDeposit: 100,
    maxLeverage: 400,
    demoCredit: 10_000,
    accent: ["#34d399", "#10b981"],
    features: [
      "No swap or rollover charges on overnight positions",
      "Copy up to 10 strategy providers",
      "Certified by an independent Shariah board",
      "Available on every instrument except crypto",
      "$10,000 demo credit on signup",
    ],
    bestFor: "Traders who need an Islamic-finance-compliant account.",
  },
];

export const ACCOUNT_TYPE_MAP: Record<AccountTypeId, AccountType> = Object.fromEntries(
  ACCOUNT_TYPES.map((a) => [a.id, a]),
) as Record<AccountTypeId, AccountType>;

export function getAccountType(id: AccountTypeId | undefined) {
  return ACCOUNT_TYPE_MAP[id ?? "standard"] ?? ACCOUNT_TYPES[0]!;
}

export const LEVERAGE_OPTIONS = [50, 100, 200, 300, 400, 500];

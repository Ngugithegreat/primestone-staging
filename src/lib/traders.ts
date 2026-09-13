import { INSTRUMENTS } from "./market";
import { seeded } from "./utils";

export type RiskLevel = "Low" | "Medium" | "High";

export type Trader = {
  id: string;
  name: string;
  handle: string;
  country: string;
  flag: string;
  /** Two-stop gradient used for the avatar and accent glows. */
  gradient: [string, string];
  verified: boolean;
  strategy: string;
  bio: string;
  markets: string[];
  /** Headline return over the trailing 12 months, percent. */
  roi12m: number;
  /** Return over the trailing 30 days, percent. */
  roi30d: number;
  winRate: number;
  followers: number;
  /** Performance fee taken from profit, percent. */
  fee: number;
  /** Months live on PrimeStone. */
  monthsActive: number;
  aum: number;
  trades: number;
  maxDrawdown: number;
  profitFactor: number;
  avgHoldHours: number;
  riskScore: number;
  risk: RiskLevel;
  copySlots: number;
  slotsTaken: number;
  minInvestment: number;
  /** True for real, admin-managed providers (copied via the wallet ledger flow). */
  isReal?: boolean;
};

type Seedling = Omit<Trader, "risk" | "flag"> & { flag?: string };

const COUNTRY_FLAG: Record<string, string> = {
  Kenya: "🇰🇪",
  Nigeria: "🇳🇬",
  "South Africa": "🇿🇦",
  Singapore: "🇸🇬",
  "United Kingdom": "🇬🇧",
  Germany: "🇩🇪",
  "United States": "🇺🇸",
  Japan: "🇯🇵",
  Brazil: "🇧🇷",
  UAE: "🇦🇪",
  Australia: "🇦🇺",
  Canada: "🇨🇦",
  Switzerland: "🇨🇭",
  India: "🇮🇳",
};

function riskOf(score: number): RiskLevel {
  if (score <= 3) return "Low";
  if (score <= 6) return "Medium";
  return "High";
}

const RAW: Seedling[] = [
  {
    id: "kw-mwangi",
    name: "Kwame Mwangi",
    handle: "@swingkwame",
    country: "Kenya",
    gradient: ["#00dfa4", "#0ea5e9"],
    verified: true,
    strategy: "Swing · Trend Following",
    bio: "Multi-week positions on majors and gold, sized off ATR. I trade the daily close and never hold through tier-1 news. Slow, boring, repeatable.",
    markets: ["XAUUSD", "EURUSD", "GBPUSD", "US100"],
    roi12m: 142.8,
    roi30d: 9.4,
    winRate: 71.2,
    followers: 12_483,
    fee: 22,
    monthsActive: 44,
    aum: 8_420_000,
    trades: 1_284,
    maxDrawdown: 11.4,
    profitFactor: 2.41,
    avgHoldHours: 62,
    riskScore: 4,
    copySlots: 15_000,
    slotsTaken: 12_483,
    minInvestment: 250,
  },
  {
    id: "elena-fischer",
    name: "Elena Fischer",
    handle: "@fx_elena",
    country: "Germany",
    gradient: ["#818cf8", "#c084fc"],
    verified: true,
    strategy: "London Session Breakout",
    bio: "Systematic breakout model on the 07:00–11:00 GMT window. Fully rules-based, flat by the New York close, no averaging down. Ever.",
    markets: ["GER40", "EURUSD", "GBPUSD"],
    roi12m: 98.6,
    roi30d: 6.1,
    winRate: 64.8,
    followers: 9_207,
    fee: 20,
    monthsActive: 61,
    aum: 11_960_000,
    trades: 3_942,
    maxDrawdown: 8.2,
    profitFactor: 1.94,
    avgHoldHours: 5,
    riskScore: 3,
    copySlots: 12_000,
    slotsTaken: 9_207,
    minInvestment: 500,
  },
  {
    id: "raj-patel",
    name: "Raj Patel",
    handle: "@quantraj",
    country: "Singapore",
    gradient: ["#22d3ee", "#3b82f6"],
    verified: true,
    strategy: "Statistical Arbitrage",
    bio: "Market-neutral pairs book across FX crosses and index futures. Positions are small, frequent and hedged; the edge is in the count, not the size.",
    markets: ["USDJPY", "USDCHF", "US30", "US100"],
    roi12m: 61.4,
    roi30d: 4.2,
    winRate: 78.9,
    followers: 15_842,
    fee: 25,
    monthsActive: 72,
    aum: 24_310_000,
    trades: 11_628,
    maxDrawdown: 5.1,
    profitFactor: 2.86,
    avgHoldHours: 2,
    riskScore: 2,
    copySlots: 16_000,
    slotsTaken: 15_842,
    minInvestment: 1_000,
  },
  {
    id: "amara-okafor",
    name: "Amara Okafor",
    handle: "@amaratrades",
    country: "Nigeria",
    gradient: ["#f59e0b", "#ef4444"],
    verified: true,
    strategy: "Crypto Momentum",
    bio: "Long-only momentum rotation across the top-10 caps. Weekly rebalance, hard 15% portfolio stop. High conviction, high variance — size accordingly.",
    markets: ["BTCUSD", "ETHUSD", "SOLUSD"],
    roi12m: 318.5,
    roi30d: 21.8,
    winRate: 58.4,
    followers: 22_106,
    fee: 30,
    monthsActive: 29,
    aum: 6_140_000,
    trades: 642,
    maxDrawdown: 34.6,
    profitFactor: 2.12,
    avgHoldHours: 168,
    riskScore: 9,
    copySlots: 25_000,
    slotsTaken: 22_106,
    minInvestment: 200,
  },
  {
    id: "marcus-hale",
    name: "Marcus Hale",
    handle: "@haleprop",
    country: "United Kingdom",
    gradient: ["#00dfa4", "#84cc16"],
    verified: true,
    strategy: "Institutional Order Flow",
    bio: "Ex-prop desk. I trade liquidity sweeps at session highs and lows on the 15m. Two to four setups a week, 1% risk each, no exceptions.",
    markets: ["EURUSD", "GBPUSD", "XAUUSD"],
    roi12m: 87.2,
    roi30d: 5.8,
    winRate: 66.1,
    followers: 7_934,
    fee: 20,
    monthsActive: 38,
    aum: 4_880_000,
    trades: 908,
    maxDrawdown: 9.8,
    profitFactor: 2.08,
    avgHoldHours: 18,
    riskScore: 4,
    copySlots: 10_000,
    slotsTaken: 7_934,
    minInvestment: 300,
  },
  {
    id: "yuki-tanaka",
    name: "Yuki Tanaka",
    handle: "@yenscalper",
    country: "Japan",
    gradient: ["#f43f5e", "#f97316"],
    verified: true,
    strategy: "Asian Session Scalping",
    bio: "Range scalps on yen pairs during Tokyo hours. Twenty to forty trades a day, tiny targets, brutal risk control. Not for the faint-hearted.",
    markets: ["USDJPY", "AUDUSD"],
    roi12m: 74.9,
    roi30d: 7.3,
    winRate: 81.6,
    followers: 6_218,
    fee: 25,
    monthsActive: 33,
    aum: 3_240_000,
    trades: 18_904,
    maxDrawdown: 13.2,
    profitFactor: 1.62,
    avgHoldHours: 1,
    riskScore: 6,
    copySlots: 8_000,
    slotsTaken: 6_218,
    minInvestment: 500,
  },
  {
    id: "sofia-alvarez",
    name: "Sofia Álvarez",
    handle: "@sofia_macro",
    country: "Brazil",
    gradient: ["#a78bfa", "#ec4899"],
    verified: false,
    strategy: "Global Macro",
    bio: "Discretionary macro. Rates, commodities and the dollar. I hold for weeks and I will sit in cash for a month if nothing lines up.",
    markets: ["XAUUSD", "XAGUSD", "USDCAD", "US30"],
    roi12m: 52.3,
    roi30d: 2.4,
    winRate: 59.7,
    followers: 3_412,
    fee: 18,
    monthsActive: 21,
    aum: 1_780_000,
    trades: 214,
    maxDrawdown: 14.8,
    profitFactor: 1.87,
    avgHoldHours: 320,
    riskScore: 5,
    copySlots: 5_000,
    slotsTaken: 3_412,
    minInvestment: 250,
  },
  {
    id: "david-chen",
    name: "David Chen",
    handle: "@chen_indices",
    country: "United States",
    gradient: ["#38bdf8", "#6366f1"],
    verified: true,
    strategy: "Index Mean Reversion",
    bio: "Fade the open, buy the panic. Nasdaq and Dow only, cash session only. Twelve years of the same three setups.",
    markets: ["US100", "US30", "NVDA", "AAPL"],
    roi12m: 109.4,
    roi30d: 8.9,
    winRate: 69.3,
    followers: 18_729,
    fee: 22,
    monthsActive: 56,
    aum: 16_720_000,
    trades: 2_806,
    maxDrawdown: 12.6,
    profitFactor: 2.24,
    avgHoldHours: 6,
    riskScore: 5,
    copySlots: 20_000,
    slotsTaken: 18_729,
    minInvestment: 500,
  },
  {
    id: "thabo-nkosi",
    name: "Thabo Nkosi",
    handle: "@thabofx",
    country: "South Africa",
    gradient: ["#facc15", "#22c55e"],
    verified: true,
    strategy: "Gold Specialist",
    bio: "Gold and silver, nothing else. I know two instruments extremely well and I would rather do that than know twenty badly.",
    markets: ["XAUUSD", "XAGUSD"],
    roi12m: 126.7,
    roi30d: 11.2,
    winRate: 67.4,
    followers: 11_058,
    fee: 24,
    monthsActive: 27,
    aum: 5_360_000,
    trades: 1_042,
    maxDrawdown: 17.9,
    profitFactor: 2.31,
    avgHoldHours: 34,
    riskScore: 6,
    copySlots: 14_000,
    slotsTaken: 11_058,
    minInvestment: 200,
  },
  {
    id: "lina-hoffmann",
    name: "Lina Hoffmann",
    handle: "@linaquant",
    country: "Switzerland",
    gradient: ["#2dd4bf", "#0284c7"],
    verified: true,
    strategy: "Low-Volatility Carry",
    bio: "Capital preservation first. Carry-positive FX positions with an option overlay. Single-digit drawdown is the product, not the return.",
    markets: ["AUDUSD", "USDCAD", "USDCHF", "EURUSD"],
    roi12m: 34.8,
    roi30d: 2.1,
    winRate: 84.2,
    followers: 5_641,
    fee: 15,
    monthsActive: 68,
    aum: 19_430_000,
    trades: 486,
    maxDrawdown: 3.4,
    profitFactor: 3.12,
    avgHoldHours: 412,
    riskScore: 1,
    copySlots: 7_000,
    slotsTaken: 5_641,
    minInvestment: 2_000,
  },
  {
    id: "omar-farouk",
    name: "Omar Farouk",
    handle: "@omar_dxb",
    country: "UAE",
    gradient: ["#fb923c", "#eab308"],
    verified: false,
    strategy: "News & Volatility",
    bio: "I trade NFP, CPI and central bank days. Nothing else. Eight to ten events a month, straddle structures, flat within the hour.",
    markets: ["EURUSD", "USDJPY", "XAUUSD", "US100"],
    roi12m: 163.2,
    roi30d: -4.6,
    winRate: 54.1,
    followers: 4_827,
    fee: 28,
    monthsActive: 18,
    aum: 2_110_000,
    trades: 386,
    maxDrawdown: 26.3,
    profitFactor: 1.78,
    avgHoldHours: 1,
    riskScore: 8,
    copySlots: 6_000,
    slotsTaken: 4_827,
    minInvestment: 300,
  },
  {
    id: "grace-wanjiru",
    name: "Grace Wanjiru",
    handle: "@gracepips",
    country: "Kenya",
    gradient: ["#c084fc", "#6366f1"],
    verified: true,
    strategy: "Smart Money Concepts",
    bio: "Higher-timeframe bias, lower-timeframe entries. I mark my levels on Sunday and I do not deviate from them during the week.",
    markets: ["GBPUSD", "EURUSD", "XAUUSD"],
    roi12m: 91.6,
    roi30d: 6.7,
    winRate: 63.8,
    followers: 8_390,
    fee: 20,
    monthsActive: 25,
    aum: 3_920_000,
    trades: 1_164,
    maxDrawdown: 15.1,
    profitFactor: 1.96,
    avgHoldHours: 22,
    riskScore: 5,
    copySlots: 10_000,
    slotsTaken: 8_390,
    minInvestment: 150,
  },
  {
    id: "james-obrien",
    name: "James O'Brien",
    handle: "@jobrien_algo",
    country: "Canada",
    gradient: ["#4ade80", "#14b8a6"],
    verified: true,
    strategy: "Machine-Learned Ensemble",
    bio: "A committee of gradient-boosted models votes on direction each hour. Retrained weekly. I do not override the model. That is the whole edge.",
    markets: ["US100", "BTCUSD", "EURUSD", "TSLA"],
    roi12m: 118.9,
    roi30d: 10.4,
    winRate: 61.5,
    followers: 13_664,
    fee: 25,
    monthsActive: 34,
    aum: 9_870_000,
    trades: 6_288,
    maxDrawdown: 18.7,
    profitFactor: 1.88,
    avgHoldHours: 4,
    riskScore: 7,
    copySlots: 15_000,
    slotsTaken: 13_664,
    minInvestment: 500,
  },
  {
    id: "priya-nair",
    name: "Priya Nair",
    handle: "@priya_equities",
    country: "India",
    gradient: ["#f472b6", "#a855f7"],
    verified: false,
    strategy: "Earnings Momentum",
    bio: "Post-earnings drift on US large caps. I enter the day after the print and hold for the fade. Concentrated book, ten names maximum.",
    markets: ["AAPL", "NVDA", "TSLA"],
    roi12m: 76.4,
    roi30d: 3.9,
    winRate: 62.9,
    followers: 2_948,
    fee: 20,
    monthsActive: 14,
    aum: 1_240_000,
    trades: 298,
    maxDrawdown: 21.4,
    profitFactor: 1.71,
    avgHoldHours: 96,
    riskScore: 7,
    copySlots: 4_000,
    slotsTaken: 2_948,
    minInvestment: 250,
  },
];

/** The hand-authored providers — richer bios, featured on the marketing site. */
const CURATED: Trader[] = RAW.map((t) => ({
  ...t,
  flag: COUNTRY_FLAG[t.country] ?? "🌐",
  risk: riskOf(t.riskScore),
}));

/* -------------------------------------------------------------------------- */
/*  Procedural leaderboard                                                     */
/*                                                                             */
/*  The curated 14 are only the top of the board. The rest are generated       */
/*  deterministically from a seed so the same provider always has the same     */
/*  numbers — which keeps SSR and client hydration in agreement and lets the   */
/*  profile pages render on demand without a database.                         */
/* -------------------------------------------------------------------------- */

type Region = "africa" | "europe" | "asia" | "mena" | "latam" | "namerica";

const GEN_COUNTRIES: { country: string; flag: string; region: Region }[] = [
  { country: "Kenya", flag: "🇰🇪", region: "africa" },
  { country: "Nigeria", flag: "🇳🇬", region: "africa" },
  { country: "South Africa", flag: "🇿🇦", region: "africa" },
  { country: "Ghana", flag: "🇬🇭", region: "africa" },
  { country: "Tanzania", flag: "🇹🇿", region: "africa" },
  { country: "Uganda", flag: "🇺🇬", region: "africa" },
  { country: "United Kingdom", flag: "🇬🇧", region: "europe" },
  { country: "Germany", flag: "🇩🇪", region: "europe" },
  { country: "France", flag: "🇫🇷", region: "europe" },
  { country: "Spain", flag: "🇪🇸", region: "europe" },
  { country: "Netherlands", flag: "🇳🇱", region: "europe" },
  { country: "Switzerland", flag: "🇨🇭", region: "europe" },
  { country: "Poland", flag: "🇵🇱", region: "europe" },
  { country: "Singapore", flag: "🇸🇬", region: "asia" },
  { country: "Japan", flag: "🇯🇵", region: "asia" },
  { country: "India", flag: "🇮🇳", region: "asia" },
  { country: "Malaysia", flag: "🇲🇾", region: "asia" },
  { country: "Philippines", flag: "🇵🇭", region: "asia" },
  { country: "Vietnam", flag: "🇻🇳", region: "asia" },
  { country: "UAE", flag: "🇦🇪", region: "mena" },
  { country: "Saudi Arabia", flag: "🇸🇦", region: "mena" },
  { country: "Egypt", flag: "🇪🇬", region: "mena" },
  { country: "Qatar", flag: "🇶🇦", region: "mena" },
  { country: "Brazil", flag: "🇧🇷", region: "latam" },
  { country: "Mexico", flag: "🇲🇽", region: "latam" },
  { country: "Argentina", flag: "🇦🇷", region: "latam" },
  { country: "Colombia", flag: "🇨🇴", region: "latam" },
  { country: "United States", flag: "🇺🇸", region: "namerica" },
  { country: "Canada", flag: "🇨🇦", region: "namerica" },
  { country: "Australia", flag: "🇦🇺", region: "namerica" },
];

const GEN_FIRST: Record<Region, string[]> = {
  africa: ["Kwame", "Amara", "Thabo", "Grace", "Kofi", "Zanele", "Emeka", "Wanjiru", "Sipho", "Adaeze", "Brian", "Fatuma", "Tendai", "Ngozi", "Jabari", "Aisha"],
  europe: ["Lukas", "Elena", "Marco", "Sofia", "Jan", "Lena", "Mateusz", "Isabelle", "Sven", "Clara", "Hugo", "Anouk", "Niklas", "Marta", "Oliver", "Freya"],
  asia: ["Wei", "Yuki", "Raj", "Priya", "Chen", "Aiko", "Arjun", "Mei", "Hiroshi", "Ananya", "Jin", "Nurul", "Rohan", "Linh", "Kenji", "Divya"],
  mena: ["Omar", "Layla", "Yusuf", "Nadia", "Khalid", "Salma", "Tariq", "Amina", "Hassan", "Rania", "Faisal", "Dina", "Karim", "Huda"],
  latam: ["Sofía", "Mateo", "Valentina", "Diego", "Camila", "Lucas", "Isabela", "Santiago", "Gabriela", "Rafael", "Luciana", "Bruno", "Renata", "Tomás"],
  namerica: ["James", "Emily", "David", "Sarah", "Michael", "Olivia", "Ryan", "Chloe", "Ethan", "Grace", "Tyler", "Maya", "Connor", "Ava"],
};

const GEN_LAST: Record<Region, string[]> = {
  africa: ["Mwangi", "Okafor", "Nkosi", "Wanjiru", "Adeyemi", "Dlamini", "Otieno", "Mensah", "Banda", "Osei", "Kamau", "Chukwu", "Mbeki", "Njoroge"],
  europe: ["Fischer", "Rossi", "Müller", "García", "Kowalski", "Andersen", "Van der Berg", "Novak", "Schmidt", "Laurent", "Weber", "Bianchi", "Nowak", "Jensen"],
  asia: ["Tanaka", "Patel", "Nair", "Chen", "Wong", "Sato", "Sharma", "Lim", "Kumar", "Suzuki", "Reddy", "Nguyen", "Kobayashi", "Rahman"],
  mena: ["Farouk", "Hassan", "Al-Rashid", "Nasser", "Khalil", "Mansour", "Aziz", "Haddad", "Saleh", "Rahman", "Karam", "Fadel"],
  latam: ["Álvarez", "Silva", "Rodríguez", "Fernández", "Costa", "Herrera", "Oliveira", "Mendoza", "Santos", "Ramírez", "Vargas", "Castro"],
  namerica: ["Chen", "O'Brien", "Hale", "Johnson", "Miller", "Anderson", "Thompson", "Nguyen", "Walker", "Bennett", "Foster", "Reed"],
};

const GEN_STRATEGIES = [
  "Trend Following", "Swing Trading", "London Breakout", "Statistical Arbitrage",
  "Crypto Momentum", "Order Flow", "Asian Session Scalping", "Global Macro",
  "Index Mean Reversion", "Gold Specialist", "Low-Volatility Carry", "News & Volatility",
  "Smart Money Concepts", "Machine-Learned Ensemble", "Earnings Momentum", "Range Trading",
  "Momentum Rotation", "Volatility Breakout", "Multi-Asset Trend", "Supply & Demand",
];

const GEN_GRADIENTS: [string, string][] = [
  ["#00dfa4", "#0ea5e9"], ["#818cf8", "#c084fc"], ["#22d3ee", "#3b82f6"],
  ["#f59e0b", "#ef4444"], ["#00dfa4", "#84cc16"], ["#f43f5e", "#f97316"],
  ["#a78bfa", "#ec4899"], ["#38bdf8", "#6366f1"], ["#facc15", "#22c55e"],
  ["#2dd4bf", "#0284c7"], ["#fb923c", "#eab308"], ["#c084fc", "#6366f1"],
  ["#4ade80", "#14b8a6"], ["#f472b6", "#a855f7"], ["#34d399", "#10b981"],
  ["#60a5fa", "#a78bfa"],
];

const GEN_STYLES: { name: string; hold: [number, number]; perMonth: [number, number] }[] = [
  { name: "scalps", hold: [1, 3], perMonth: [280, 820] },
  { name: "intraday setups", hold: [4, 14], perMonth: [70, 220] },
  { name: "multi-day swings", hold: [22, 90], perMonth: [14, 42] },
  { name: "position trades", hold: [150, 460], perMonth: [3, 12] },
];

const GEN_PHILOSOPHY = [
  "Fully rules-based, flat by the weekend, no averaging down.",
  "Capital preservation first — the drawdown number is the product, not the return.",
  "Two to four high-conviction setups a week, fixed 1% risk on each.",
  "I trade one thing extremely well rather than twenty things badly.",
  "Systematic entries, discretionary exits, and a hard stop on every position.",
  "Slow, boring and repeatable. That is the entire edge.",
  "I sit in cash for weeks if nothing lines up. Patience is a position.",
  "Every trade is journalled and reviewed. The process outlives any single month.",
  "Risk is defined before the entry, never after. No exceptions.",
  "High conviction, high variance — size accordingly and respect the stop.",
];

const GEN_MARKET_IDS = INSTRUMENTS.map((i) => i.id);

function pick<T>(r: () => number, arr: T[]): T {
  return arr[Math.floor(r() * arr.length)]!;
}
function rint(r: () => number, min: number, max: number) {
  return Math.round(min + (max - min) * r());
}
function rnum(r: () => number, min: number, max: number, decimals = 1) {
  const f = 10 ** decimals;
  return Math.round((min + (max - min) * r()) * f) / f;
}

function buildProvider(index: number): Trader {
  // A per-index seed keeps every generated provider stable across renders.
  const r = seeded((index + 1) * 2654435761);

  const place = pick(r, GEN_COUNTRIES);
  const first = pick(r, GEN_FIRST[place.region]);
  const last = pick(r, GEN_LAST[place.region]);
  const name = `${first} ${last}`;

  const roll = r();
  const arch = roll < 0.34 ? "cons" : roll < 0.76 ? "bal" : "agg";

  const riskScore =
    arch === "cons" ? rint(r, 1, 3) : arch === "bal" ? rint(r, 3, 6) : rint(r, 6, 10);
  const roi12m =
    arch === "cons" ? rnum(r, 12, 55) : arch === "bal" ? rnum(r, 40, 132) : rnum(r, 88, 340);
  const maxDrawdown =
    arch === "cons" ? rnum(r, 2.4, 9) : arch === "bal" ? rnum(r, 8, 18) : rnum(r, 18, 39);
  const winRate =
    arch === "cons" ? rnum(r, 72, 86) : arch === "bal" ? rnum(r, 58, 73) : rnum(r, 50, 63);
  const profitFactor =
    arch === "cons" ? rnum(r, 2.2, 3.3, 2) : arch === "bal" ? rnum(r, 1.7, 2.4, 2) : rnum(r, 1.55, 2.2, 2);

  const style = pick(r, GEN_STYLES);
  const avgHoldHours = rint(r, style.hold[0], style.hold[1]);
  const monthsActive = rint(r, 7, 84);
  const trades = Math.round(rint(r, style.perMonth[0], style.perMonth[1]) * (monthsActive / 12));

  // Followers track results and tenure; strong recent performers draw a crowd.
  const followers = Math.max(
    280,
    Math.min(
      26_000,
      Math.round(360 + roi12m * 42 + (winRate - 50) * 190 + r() * 6200),
    ),
  );
  const verified = r() < 0.5 + (monthsActive / 84) * 0.36;
  const aum = followers * rint(r, 420, 2600);
  const fee = rint(r, 15, 30);
  const copySlots = Math.ceil(followers / (0.58 + 0.34 * r()) / 1000) * 1000;

  const monthly = ((1 + roi12m / 100) ** (1 / 12) - 1) * 100;
  const roi30d =
    arch === "agg" && r() < 0.28
      ? rnum(r, -6, -0.5)
      : rnum(r, monthly * 0.3, monthly * 2.2);

  const markets: string[] = [];
  const marketCount = rint(r, 2, 4);
  while (markets.length < marketCount) {
    const m = pick(r, GEN_MARKET_IDS);
    if (!markets.includes(m)) markets.push(m);
  }

  const strategy = pick(r, GEN_STRATEGIES);
  const bio = `I run a ${strategy.toLowerCase()} book, mostly ${style.name} on ${markets
    .slice(0, 2)
    .join(" and ")}. ${pick(r, GEN_PHILOSOPHY)}`;

  const handleBase = `${first}${last[0]}`.toLowerCase().replace(/[^a-z]/g, "");
  const handleSuffix = r() < 0.5 ? pick(r, ["fx", "trades", "pips", "capital", "live", "hq", "trading"]) : "";
  const handle = `@${handleBase}${handleSuffix}`;

  const minInvestment = pick(r, [100, 150, 200, 250, 300, 500, 1000, 2000]);

  return {
    id: `sp-${String(index).padStart(4, "0")}`,
    name,
    handle,
    country: place.country,
    flag: place.flag,
    gradient: pick(r, GEN_GRADIENTS),
    verified,
    strategy,
    bio,
    markets,
    roi12m,
    roi30d,
    winRate,
    followers,
    fee,
    monthsActive,
    aum,
    trades,
    maxDrawdown,
    profitFactor,
    avgHoldHours,
    riskScore,
    risk: riskOf(riskScore),
    copySlots,
    slotsTaken: followers,
    minInvestment,
  };
}

const TARGET_TOTAL = 340;
const GENERATED: Trader[] = Array.from({ length: TARGET_TOTAL - CURATED.length }, (_, i) =>
  buildProvider(i),
);

export const TRADERS: Trader[] = [...CURATED, ...GENERATED];

/** Hand-authored providers, best 12-month return first — used where copy quality is on show. */
export const FEATURED_TRADERS: Trader[] = [...CURATED].sort((a, b) => b.roi12m - a.roi12m);

/** Aggregates derived from the real provider set, so headline stats never contradict the data. */
export const PLATFORM_STATS = {
  providers: TRADERS.length,
  copiers: TRADERS.reduce((sum, t) => sum + t.followers, 0),
  volume: TRADERS.reduce((sum, t) => sum + t.aum, 0),
  avgLatencyMs: 40,
};

export const TRADER_MAP: Record<string, Trader> = Object.fromEntries(
  TRADERS.map((t) => [t.id, t]),
);

export function getTrader(id: string) {
  return TRADER_MAP[id];
}

/**
 * A monotone-ish equity curve consistent with the trader's headline ROI and
 * drawdown. Deterministic, so it renders identically on server and client.
 */
export function equityCurve(trader: Trader, points = 120) {
  const rand = seeded(
    trader.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 977 + points,
  );
  const target = trader.roi12m / 100;
  const perStep = (1 + target) ** (1 / points) - 1;
  const noise = (trader.maxDrawdown / 100) * 0.42;

  const out: { i: number; value: number; label: string }[] = [];
  let value = 100;
  let shock = 0;

  for (let i = 0; i < points; i++) {
    // Occasional drawdown clusters keep the curve from looking like a ruler.
    if (rand() < 0.06) shock = -noise * (0.4 + rand()) * 100;
    shock *= 0.82;
    value = value * (1 + perStep) + shock * 0.12 + (rand() - 0.5) * noise * 26;
    value = Math.max(72, value);
    out.push({
      i,
      value: Math.round(value * 100) / 100,
      label: `Week ${Math.floor((i / points) * 52) + 1}`,
    });
  }

  // Land exactly on the advertised 12-month return.
  const scale = (100 * (1 + target)) / out[out.length - 1]!.value;
  return out.map((p) => ({ ...p, value: Math.round(p.value * scale * 100) / 100 }));
}

/** Twelve monthly return percentages that compound to roughly roi12m. */
export function monthlyReturns(trader: Trader) {
  const rand = seeded(
    trader.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 31 + 7,
  );
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const avg = (1 + trader.roi12m / 100) ** (1 / 12) - 1;
  const spread = (trader.maxDrawdown / 100) * 0.85;

  return months.map((m) => {
    const r = (avg + (rand() - 0.42) * spread) * 100;
    return { month: m, value: Math.round(r * 10) / 10 };
  });
}

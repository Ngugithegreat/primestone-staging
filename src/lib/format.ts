export function money(value: number, currency = "USD", maxFrac = 2) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: maxFrac,
    maximumFractionDigits: maxFrac,
  }).format(value);
}

/** Compact money for tiles: $1.24M, $980.5K */
export function moneyCompact(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function num(value: number, frac = 2) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  });
}

export function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export function pct(value: number, frac = 1) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(frac)}%`;
}

export function signed(value: number, frac = 2) {
  return `${value >= 0 ? "+" : "-"}$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  })}`;
}

/** Fixed-locale date string — identical on server and client. */
export function dateShort(ts: number) {
  const d = new Date(ts);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function timeShort(ts: number) {
  const d = new Date(ts);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function dateTimeShort(ts: number) {
  return `${dateShort(ts)} · ${timeShort(ts)}`;
}

export function relativeTime(ts: number, now: number) {
  const diff = Math.max(0, now - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function durationSince(months: number) {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m}mo`;
  if (m === 0) return `${y}y`;
  return `${y}y ${m}mo`;
}

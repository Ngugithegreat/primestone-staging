/**
 * Joins class names, dropping anything falsy. Accepts `unknown` because the
 * `cond && "class"` idiom widens to whatever `cond` is (React nodes included).
 */
export function cn(...parts: unknown[]) {
  return parts.filter((p): p is string => typeof p === "string" && p.length > 0).join(" ");
}

/**
 * Mulberry32 — a tiny seeded PRNG.
 * Every piece of demo data is generated through this so the server render and
 * the client hydration produce byte-identical markup.
 */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

export function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

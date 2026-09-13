/**
 * Canonical site origin for building links inside emails.
 * Set NEXT_PUBLIC_SITE_URL (e.g. https://primestonemarkets.com) in production;
 * otherwise falls back to Vercel's deployment URL, then localhost.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

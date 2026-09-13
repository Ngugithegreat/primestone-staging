/**
 * A stable, human-friendly account number for tracing a user.
 *
 * Derived directly from the first 32 bits of the user's UUID, so it's
 * deterministic (same everywhere — user side and admin side) and inherits the
 * UUID's uniqueness. The full UUID stays the real primary key; this is just a
 * readable reference support and the user can quote.
 */
export function accountNumber(id: string | null | undefined): string {
  if (!id) return "—";
  const hex = id.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `PS-${hex}`;
}

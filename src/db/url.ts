/**
 * Resolve the Postgres connection string from whichever env var is present.
 *
 * Different providers/integrations inject different names:
 *   - a manual `DATABASE_URL`
 *   - Neon / Vercel Postgres → `POSTGRES_URL` (pooled), `POSTGRES_URL_NON_POOLING`
 *   - Neon's Vercel integration → `DATABASE_URL`, `DATABASE_URL_UNPOOLED`
 *
 * The running app wants the POOLED url (serverless-friendly); migrations want a
 * DIRECT url (a transaction pooler can choke on some DDL).
 */

function pick(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

export function runtimeDatabaseUrl(): string | undefined {
  return pick(["DATABASE_URL", "POSTGRES_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"]);
}

export function migrationDatabaseUrl(): string | undefined {
  return pick(["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "DATABASE_URL", "POSTGRES_URL"]);
}

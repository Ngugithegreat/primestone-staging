import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { runtimeDatabaseUrl } from "./url";

/**
 * Production database client.
 *
 * Targets any standard Postgres (Neon, Supabase, RDS…) via a `DATABASE_URL`
 * connection string. The connection is created lazily on first use so that a
 * build with no database configured still succeeds — only code paths that
 * actually touch the database require the env var.
 *
 * The service functions in `src/server/*` take a `db` argument rather than
 * importing this singleton, which keeps them testable against an embedded
 * Postgres (see `scripts/verify-backend.ts`).
 */
export type Database = PostgresJsDatabase<typeof schema>;

let _db: Database | null = null;
let _client: postgres.Sql | null = null;

/**
 * postgres.js does not implement SCRAM channel binding, so a connection string
 * carrying `channel_binding=require` (which Neon now appends by default) makes
 * every connection fail — the whole app 500s while the data sits safe. Strip it;
 * TLS is still enforced by `sslmode=require`.
 */
function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch {
    return url.replace(/([?&])channel_binding=[^&]*(&|$)/i, "$1").replace(/[?&]$/, "");
  }
}

export function getDb(): Database {
  if (_db) return _db;

  const url = runtimeDatabaseUrl();
  if (!url) {
    throw new Error(
      "No Postgres connection string found. Set DATABASE_URL (or POSTGRES_URL) " +
        "in the environment (Vercel → Settings → Environment Variables) before " +
        "using the database.",
    );
  }

  // `prepare: false` is required when connecting through a transaction pooler
  // such as Neon's or Supabase's PgBouncer in transaction mode.
  _client = postgres(sanitizeUrl(url), { prepare: false });
  _db = drizzle(_client, { schema });
  return _db;
}

export { schema };

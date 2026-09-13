import "server-only";
import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { migrationDatabaseUrl } from "@/db/url";
import { getDb, schema } from "@/db/client";

/**
 * One-time setup endpoint for a freshly provisioned database that has no
 * `vercel env pull` / shell access attached to it (e.g. this staging clone).
 * Bearer-token gated with CRON_SECRET. Safe to call more than once — statements
 * that fail because the object already exists are skipped, not fatal.
 *
 * POST /api/ops/bootstrap            -> applies drizzle/*.sql in order
 * POST /api/ops/bootstrap?action=promote&email=x@y.com -> sets role='owner'
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

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function runMigrations() {
  const url = migrationDatabaseUrl();
  if (!url) throw new Error("No DATABASE_URL configured");

  const sql = postgres(sanitizeUrl(url), { prepare: false, max: 1 });
  const dir = path.join(process.cwd(), "drizzle");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const results: { file: string; statements: number; skipped: number }[] = [];
  try {
    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), "utf8");
      const statements = content
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);
      let skipped = 0;
      for (const stmt of statements) {
        try {
          await sql.unsafe(stmt);
        } catch (err) {
          const code = (err as { code?: string })?.code;
          // 42710 duplicate_object, 42P07 duplicate_table, 42701 duplicate_column
          if (code === "42710" || code === "42P07" || code === "42701") {
            skipped++;
            continue;
          }
          throw err;
        }
      }
      results.push({ file, statements: statements.length, skipped });
    }
    return results;
  } finally {
    await sql.end();
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const action = req.nextUrl.searchParams.get("action") ?? "migrate";

  if (action === "migrate") {
    try {
      const results = await runMigrations();
      return NextResponse.json({ ok: true, results });
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      );
    }
  }

  if (action === "rename-provider") {
    const handle = req.nextUrl.searchParams.get("handle");
    const name = req.nextUrl.searchParams.get("name");
    const newHandle = req.nextUrl.searchParams.get("newHandle") ?? undefined;
    if (!handle || !name) {
      return NextResponse.json({ error: "missing ?handle= or ?name=" }, { status: 400 });
    }
    const db = getDb();
    const [updated] = await db
      .update(schema.signalProviders)
      .set({ name, ...(newHandle ? { handle: newHandle } : {}) })
      .where(eq(schema.signalProviders.handle, handle))
      .returning({ id: schema.signalProviders.id, name: schema.signalProviders.name, handle: schema.signalProviders.handle });
    if (!updated) {
      return NextResponse.json({ ok: false, error: "no provider with that handle" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, updated });
  }

  if (action === "promote") {
    const email = req.nextUrl.searchParams.get("email");
    if (!email) {
      return NextResponse.json({ error: "missing ?email=" }, { status: 400 });
    }
    const db = getDb();
    const [updated] = await db
      .update(schema.users)
      .set({ role: "owner" })
      .where(eq(schema.users.email, email))
      .returning({ id: schema.users.id, email: schema.users.email, role: schema.users.role });
    if (!updated) {
      return NextResponse.json({ ok: false, error: "no user with that email" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, updated });
  }

  return NextResponse.json({ error: `unknown action ${action}` }, { status: 400 });
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const db = getDb();
    if (req.nextUrl.searchParams.get("action") === "list-providers") {
      const providers = await db
        .select({
          id: schema.signalProviders.id,
          name: schema.signalProviders.name,
          handle: schema.signalProviders.handle,
        })
        .from(schema.signalProviders);
      return NextResponse.json({ ok: true, providers });
    }
    const count = await db.$count(schema.users);
    return NextResponse.json({ ok: true, usersTableExists: true, userCount: count });
  } catch (err) {
    return NextResponse.json({ ok: true, usersTableExists: false, error: String(err) });
  }
}

# PrimeStone backend

A real, database-backed foundation for the regulated parts of the platform:
authentication, KYC, client money (deposits, withdrawals, allocations) and the
owner-managed signal providers.

## What is built

| Area | Status |
| --- | --- |
| Postgres schema (11 tables) | ✅ `src/db/schema.ts` + migration in `drizzle/` |
| Email/password auth + sessions | ✅ `src/server/auth.ts`, `src/server/session.ts` |
| Immutable double-entry ledger | ✅ `src/server/ledger.ts` |
| Deposits / withdrawals (KYC-gated, idempotent) | ✅ `src/server/payments.ts` |
| Allocations to providers | ✅ `src/server/allocations.ts` |
| KYC submit + admin review | ✅ `src/server/kyc.ts` |
| Signal providers (owner-managed) | ✅ `src/server/providers.ts` |
| Auth API routes | ✅ `src/app/api/auth/*` |
| End-to-end test (34 checks) | ✅ `npm run verify:backend` |

**Not yet wired:** the front-end still uses its in-browser demo store. Moving
the app's signup/login/wallet/KYC screens onto these APIs is the next phase (see
"Next" below). Payment network calls (M-Pesa STK push, card, crypto) and KYC
file upload to Blob storage are stubbed at the boundary — the ledger and state
machine behind them are real and tested.

## Design guarantees

- **Money is integer cents**, never a float, stored in an immutable double-entry
  ledger. A balance is always `sum(entries)` — it can be reconciled and can
  never silently drift. Every transaction's legs must sum to zero or it is
  rejected and nothing is written.
- **Deposits credit only on a confirmed PSP callback**, keyed on the PSP receipt
  under a unique constraint, so a duplicated callback can never double-credit.
- **Withdrawals are hard-gated on KYC** in the service layer, not just the UI.
- **Passwords** use Node `scrypt` with per-user salts; **session tokens** are
  stored only as SHA-256 hashes; the raw token lives in an httpOnly cookie.
- **ID numbers are never stored raw** — only a display mask + a salted hash.

## Go live: what only you can provision

1. **Database — Neon (recommended) or Supabase.**
   - Create a project, copy the **pooled** connection string.
   - Add it to Vercel → Settings → Environment Variables as `DATABASE_URL`
     (Production, Preview, Development).
   - Locally: put it in `.env.local` (copy from `.env.example`).
   - Apply the schema: `npm run db:migrate`
   - Seed an owner + sample providers: `npm run db:seed`
     (set `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` first; change the password
     immediately after).

2. **KYC document storage — Vercel Blob.**
   - Create a Blob store in the Vercel dashboard; add its `BLOB_READ_WRITE_TOKEN`.
   - The upload route (next phase) streams documents straight to Blob; only the
     storage key is kept in Postgres.

3. **M-Pesa — Safaricom Daraja.**
   - Add the sandbox `MPESA_*` values from `.env.example`; build and test the
     STK-push + callback against the sandbox first.
   - Switch to production credentials only after Daraja go-live approval.

4. **Secrets hygiene.** Set `KYC_HASH_SALT` to a long random value. Never commit
   any real value — `.env*` is gitignored; `.env.example` is the only committed
   template.

## Commands

```bash
npm run db:generate     # regenerate SQL migration after editing the schema
npm run db:migrate      # apply migrations to DATABASE_URL
npm run db:seed         # owner account + sample providers
npm run db:studio       # browse the database
npm run verify:backend  # run the 34-check end-to-end test (embedded Postgres)
```

## Next (phase 2)

1. Wire signup + login screens to `/api/auth/*`; replace the demo `signIn`.
2. KYC upload route → Vercel Blob; point the verify screen at it; move the admin
   console onto `listPendingKyc` / `reviewKyc`.
3. Deposit route → M-Pesa STK push; `/api/payments/mpesa/callback` →
   `confirmDeposit`. Then card (Paystack) and crypto.
4. Allocation UI → `allocate` / `deallocate`; provider admin screen → `providers`.
5. **Before handling real client money:** an independent security review and the
   CMA compliance sign-off. This code is written to be correct, but it has not
   yet been through either.
```

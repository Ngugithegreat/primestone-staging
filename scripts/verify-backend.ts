/**
 * End-to-end backend verification against embedded Postgres (PGlite).
 *
 * PGlite is real Postgres compiled to WASM, so this exercises the actual SQL,
 * constraints and transactions the production database will run — no server,
 * no network, no mocks. Run it with:  npm run verify:backend
 *
 * It walks the full money path: register → login/session → deposit (ledger) →
 * KYC submit + admin review → allocate to a provider → withdraw (KYC-gated) →
 * and asserts the ledger stays balanced throughout.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq, sql } from "drizzle-orm";
import * as schema from "../src/db/schema";
import type { Database } from "../src/db/client";
import {
  createSession,
  login,
  register,
  resolveSession,
} from "../src/server/auth";
import {
  balanceOf,
  clientCashBalance,
  ensureClientCashAccount,
  ensureSystemAccount,
  post,
  toMajor,
  toMinor,
} from "../src/server/ledger";
import {
  adminCreditUser,
  completeWithdrawal,
  confirmDeposit,
  initiateDeposit,
  rejectWithdrawal,
  requestWithdrawal,
} from "../src/server/payments";
import { submitKyc, reviewKyc } from "../src/server/kyc";
import { createProvider } from "../src/server/providers";
import { allocate, deallocate, listAllocations } from "../src/server/allocations";
import {
  activeAllocationValues,
  closeProviderPosition,
  liquidateBlownAllocations,
  openProviderPosition,
} from "../src/server/copyEngine";
import { ledgerEntries } from "../src/db/schema";
import { createHmac } from "node:crypto";
import { generateSecret, verifyTotp } from "../src/server/totp";
import { begin2FASetup, enable2FA, is2FAEnabled, verify2FA, disable2FA } from "../src/server/twoFactor";
import { isEmailVerified, startEmailVerification, verifyEmailCode } from "../src/server/emailVerify";
import { blowAgedAllocations } from "../src/server/testTools";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.error(`  ✗ ${label} ${detail}`);
  }
}

/** Compute the current 6-digit TOTP for a base32 secret (mirrors totp.ts). */
function currentTotp(secret: string): string {
  const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = secret.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const c of clean) {
    const idx = B32.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", Buffer.from(bytes)).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const bin =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(bin % 1_000_000).padStart(6, "0");
}

/** Assert the entire ledger nets to zero — the core money invariant. */
async function assertLedgerBalanced(db: Database, label: string) {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${ledgerEntries.amount}),0)::bigint` })
    .from(ledgerEntries);
  check(`ledger nets to zero — ${label}`, Number(row?.total ?? 0) === 0, `(got ${row?.total})`);
}

async function main() {
  console.log("\nPrimeStone backend verification (embedded Postgres)\n");

  const pg = new PGlite();
  const db = drizzle(pg, { schema }) as unknown as Database;

  // Apply every generated migration in order.
  const migrationsDir = join(process.cwd(), "drizzle");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sqlText = readFileSync(join(migrationsDir, file), "utf8");
    for (const stmt of sqlText.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed) await pg.exec(trimmed);
    }
  }
  console.log(`Schema applied (${files.length} migration${files.length === 1 ? "" : "s"}).\n`);

  /* --- Auth ------------------------------------------------------------- */
  console.log("Auth");
  const reg = await register(db, {
    email: "Client@Example.com",
    password: "correct horse battery",
    firstName: "Amina",
    lastName: "Okafor",
    phone: "+254700000001",
    country: "Kenya",
    accountType: "standard",
  });
  check("register succeeds", reg.ok);
  const userId = reg.ok ? reg.user.id : "";
  check("email normalised to lowercase", reg.ok && reg.user.email === "client@example.com");

  const dupe = await register(db, {
    email: "client@example.com",
    password: "another one two",
    firstName: "Imposter",
  });
  check("duplicate email rejected", !dupe.ok);

  const badLogin = await login(db, "client@example.com", "wrong password");
  check("wrong password rejected", !badLogin.ok);
  const goodLogin = await login(db, "client@example.com", "correct horse battery");
  check("correct password accepted", goodLogin.ok);

  const { token } = await createSession(db, userId);
  const resolved = await resolveSession(db, token);
  check("session resolves to the user", resolved?.id === userId);
  check("bad session token resolves to null", (await resolveSession(db, "deadbeef")) === null);

  /* --- Deposit (ledger) ------------------------------------------------- */
  console.log("\nDeposits");
  await ensureSystemAccount(db, "system_deposits_clearing");
  const payId = await initiateDeposit(db, { userId, provider: "mpesa", amount: 500 });
  const conf = await confirmDeposit(db, { paymentId: payId, externalRef: "MPESA-RCT-001" });
  check("deposit confirmed", conf.ok && !conf.alreadyProcessed);

  let cash = await clientCashBalance(db, userId);
  check("cash credited $500.00", cash === toMinor(500), `(got ${toMajor(cash)})`);

  // Idempotency: replaying the same callback must not double-credit.
  const replay = await confirmDeposit(db, { paymentId: payId, externalRef: "MPESA-RCT-001" });
  check("duplicate callback is idempotent", replay.alreadyProcessed);
  cash = await clientCashBalance(db, userId);
  check("cash still $500.00 after replay", cash === toMinor(500), `(got ${toMajor(cash)})`);
  await assertLedgerBalanced(db, "after deposit");

  /* --- Withdrawal gated on KYC ------------------------------------------ */
  console.log("\nKYC gate on withdrawal");
  const blocked = await requestWithdrawal(db, {
    userId,
    provider: "mpesa",
    amount: 100,
    destination: "+254700000001",
  });
  check("withdrawal blocked before KYC", !blocked.ok);

  /* --- KYC submit + admin review ---------------------------------------- */
  console.log("\nKYC");
  const docs = (["id_front", "id_back", "selfie", "proof_of_address"] as const).map((type) => ({
    type,
    storageKey: `blob://kyc/${userId}/${type}`,
    fileName: `${type}.jpg`,
    fileSize: 1024,
    contentType: "image/jpeg",
  }));
  const submitted = await submitKyc(db, {
    userId,
    idType: "National ID",
    idNumber: "12345678",
    dateOfBirth: "1994-06-12",
    residentialAddress: "12 Kenyatta Ave, Nairobi",
    documents: docs,
  });
  check("KYC submitted", submitted.ok);

  const [afterSubmit] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  check("user KYC cache = pending", afterSubmit?.kycStatusCache === "pending");
  const [profile] = await db
    .select()
    .from(schema.kycProfiles)
    .where(eq(schema.kycProfiles.userId, userId));
  check("id number stored masked, not raw", profile?.idNumberMasked === "••••5678");
  check("raw id number never stored", !JSON.stringify(profile).includes("12345678"));

  // A client cannot approve KYC.
  const notAdmin = await reviewKyc(db, {
    reviewerId: userId,
    userId,
    decision: "verified",
  });
  check("client cannot approve KYC", !notAdmin.ok);

  // Make an owner and approve.
  const ownerReg = await register(db, {
    email: "owner@primestone.com",
    password: "owner secret pass",
    firstName: "Owner",
  });
  const ownerId = ownerReg.ok ? ownerReg.user.id : "";
  await db.update(schema.users).set({ role: "owner" }).where(eq(schema.users.id, ownerId));
  const approved = await reviewKyc(db, { reviewerId: ownerId, userId, decision: "verified" });
  check("owner approves KYC", approved.ok);
  const [afterApprove] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  check("user KYC cache = verified", afterApprove?.kycStatusCache === "verified");

  /* --- Providers + allocation ------------------------------------------- */
  console.log("\nProviders & allocations");
  const prov = await createProvider(db, {
    name: "Kwame Mwangi",
    strategy: "Swing / Trend",
    feeBps: 2000,
    minInvestment: 100,
    verified: true,
  });
  check("provider created", prov.ok);
  const providerId = prov.ok ? prov.id : "";

  const tooSmall = await allocate(db, { userId, providerId, amount: 50 });
  check("allocation below minimum rejected", !tooSmall.ok);

  const alloc = await allocate(db, { userId, providerId, amount: 300 });
  check("allocate $300 succeeds", alloc.ok);
  cash = await clientCashBalance(db, userId);
  check("cash reduced to $200.00 after allocation", cash === toMinor(200), `(got ${toMajor(cash)})`);

  const overAllocate = await allocate(db, { userId, providerId, amount: 9999 });
  check("over-allocation rejected", !overAllocate.ok);

  const list = await listAllocations(db, userId);
  check("allocation appears in list", list.length === 1 && list[0]!.allocation.amount === toMinor(300));
  await assertLedgerBalanced(db, "after allocation");

  /* --- Withdrawal after verification ------------------------------------ */
  console.log("\nWithdrawal after verification");
  const wd = await requestWithdrawal(db, {
    userId,
    provider: "mpesa",
    amount: 150,
    fee: 0,
    destination: "+254700000001",
  });
  check("withdrawal now allowed", wd.ok);
  cash = await clientCashBalance(db, userId);
  check("cash reduced to $50.00 after withdrawal", cash === toMinor(50), `(got ${toMajor(cash)})`);

  const overdraw = await requestWithdrawal(db, {
    userId,
    provider: "mpesa",
    amount: 9999,
    destination: "+254700000001",
  });
  check("overdraw rejected", !overdraw.ok);
  await assertLedgerBalanced(db, "after withdrawal");

  // Operator marks the $150 withdrawal as paid — status flips, no ledger change.
  const paid = await completeWithdrawal(db, {
    paymentId: wd.ok ? wd.paymentId : "",
  });
  check("withdrawal marked paid", paid.ok);
  cash = await clientCashBalance(db, userId);
  check("marking paid does not change cash ($50.00)", cash === toMinor(50), `(got ${toMajor(cash)})`);

  // A second request that is rejected returns the funds to the client's cash.
  const wd2 = await requestWithdrawal(db, {
    userId,
    provider: "mpesa",
    amount: 20,
    destination: "+254700000001",
  });
  check("second withdrawal ($20) locks funds", wd2.ok);
  cash = await clientCashBalance(db, userId);
  check("cash reduced to $30.00 while pending", cash === toMinor(30), `(got ${toMajor(cash)})`);
  const rejected = await rejectWithdrawal(db, {
    paymentId: wd2.ok ? wd2.paymentId : "",
    reason: "test",
  });
  check("withdrawal rejected", rejected.ok);
  cash = await clientCashBalance(db, userId);
  check("rejected withdrawal refunds to $50.00", cash === toMinor(50), `(got ${toMajor(cash)})`);
  await assertLedgerBalanced(db, "after withdrawal settlement");

  /* --- Deallocate ------------------------------------------------------- */
  console.log("\nDeallocation");
  const allocId = alloc.ok ? alloc.allocationId : "";
  const back = await deallocate(db, { userId, allocationId: allocId });
  check("deallocate returns committed funds", back.ok && back.ok === true);
  cash = await clientCashBalance(db, userId);
  check("cash back to $350.00 after deallocation", cash === toMinor(350), `(got ${toMajor(cash)})`);
  await assertLedgerBalanced(db, "after deallocation");

  /* --- Copy-trade engine (settlement) ----------------------------------- */
  console.log("\nCopy-trade engine");
  process.env.COPY_SETTLEMENT = "live";

  // Cash is $350 after deallocation; commit $200 to copy.
  const alloc2 = await allocate(db, { userId, providerId, amount: 200 });
  check("re-allocate $200 for copy test", alloc2.ok);

  // A winning BUY: entry 100 → exit 110 on 50% of the $200 allocation = $100
  // stake → +$10 gross, 20% fee = $2, so +$8 net to the client.
  const openWin = await openProviderPosition(db, {
    providerId,
    symbol: "BTCUSD",
    side: "buy",
    price: 100,
    sizePct: 0.5,
  });
  check("provider position opened + mirrored to 1 allocation", openWin.ok && openWin.mirrors === 1);
  // Risk = 50% of $200 = $100. Default stop 2%; exit +1% = halfway to the stop
  // distance ⇒ +0.5× risk = +$50 gross, 20% fee = $10, net +$40.
  const closeWin = await closeProviderPosition(db, {
    positionId: openWin.ok ? openWin.positionId : "",
    exitPrice: 101,
    reason: "test",
  });
  check(
    "winning trade: net +$40.00 after 20% fee ($10.00)",
    closeWin.ok && closeWin.netPnlMinor === toMinor(40) && closeWin.feeMinor === toMinor(10),
    closeWin.ok ? `(net ${closeWin.netPnlMinor}, fee ${closeWin.feeMinor})` : "",
  );
  const av1 = await activeAllocationValues(db, userId);
  check("profit credited: allocation now $240.00", av1.totalMinor === toMinor(240), `(got ${toMajor(av1.totalMinor)})`);
  const pnlBal = await balanceOf(db, await ensureSystemAccount(db, "system_pnl"));
  const feeBal = await balanceOf(db, await ensureSystemAccount(db, "system_fees"));
  check("house P&L account paid the gross (-$50.00)", pnlBal === -toMinor(50), `(got ${toMajor(pnlBal)})`);
  check("fees account earned $10.00", feeBal === toMinor(10), `(got ${toMajor(feeBal)})`);
  await assertLedgerBalanced(db, "after winning copy trade");

  // A catastrophic SELL: price triples against it — loss is clamped so a single
  // position can never lose more than its $100 stake.
  const openLoss = await openProviderPosition(db, {
    providerId,
    symbol: "BTCUSD",
    side: "sell",
    price: 100,
    sizePct: 0.5,
  });
  const closeLoss = await closeProviderPosition(db, {
    positionId: openLoss.ok ? openLoss.positionId : "",
    exitPrice: 300,
    reason: "test",
  });
  // Risk = 50% of the post-win $240 balance = $120; full stop-out loses it all.
  check(
    "losing trade floored at the risked amount (-$120.00)",
    closeLoss.ok && closeLoss.netPnlMinor === -toMinor(120),
    closeLoss.ok ? `(got ${closeLoss.netPnlMinor})` : "",
  );
  const av2 = await activeAllocationValues(db, userId);
  check("loss debited: allocation now $120.00", av2.totalMinor === toMinor(120), `(got ${toMajor(av2.totalMinor)})`);
  await assertLedgerBalanced(db, "after losing copy trade");

  // Paper mode must move NO real money.
  process.env.COPY_SETTLEMENT = "paper";
  const beforePaper = (await activeAllocationValues(db, userId)).totalMinor;
  const openPaper = await openProviderPosition(db, {
    providerId,
    symbol: "BTCUSD",
    side: "buy",
    price: 100,
    sizePct: 0.5,
  });
  const closePaper = await closeProviderPosition(db, {
    positionId: openPaper.ok ? openPaper.positionId : "",
    exitPrice: 150,
    reason: "test",
  });
  check("paper-mode close succeeds", closePaper.ok);
  const afterPaper = (await activeAllocationValues(db, userId)).totalMinor;
  check(
    "paper mode leaves real balances untouched",
    afterPaper === beforePaper,
    `(before ${beforePaper}, after ${afterPaper})`,
  );
  await assertLedgerBalanced(db, "after paper trade");

  /* --- Re-copy after a blown run (no phantom capital) ------------------- */
  console.log("\nRe-copy after a blown run");
  const prov2 = await createProvider(db, {
    name: "Blow Test FX",
    strategy: "Test",
    feeBps: 2000,
    minInvestment: 100,
    verified: true,
  });
  const pid2 = prov2.ok ? prov2.id : "";
  check("second provider created", prov2.ok);

  await adminCreditUser(db, { userId, amountUsd: 100 });
  const copy1 = await allocate(db, { userId, providerId: pid2, amount: 100 });
  check("copy #1 ok", copy1.ok);
  check(
    "allocated $100 after copy #1",
    ((await activeAllocationValues(db, userId)).byProvider[pid2] ?? 0) === 10000,
  );

  // Blow it: drain the allocation account to $0 via a losing trade.
  const [aacc] = await db
    .select({ id: schema.ledgerAccounts.id })
    .from(schema.ledgerAccounts)
    .where(
      and(
        eq(schema.ledgerAccounts.kind, "client_allocation"),
        eq(schema.ledgerAccounts.userId, userId),
        eq(schema.ledgerAccounts.providerId, pid2),
      ),
    )
    .limit(1);
  const pnlAcc = await ensureSystemAccount(db, "system_pnl", "USD");
  await post(db, {
    kind: "trade_pnl",
    reference: `blowtest:${userId}`,
    currency: "USD",
    legs: [
      { accountId: aacc!.id, amount: -10000 },
      { accountId: pnlAcc, amount: 10000 },
    ],
  });
  check(
    "allocation blown to $0",
    ((await activeAllocationValues(db, userId)).byProvider[pid2] ?? 0) === 0,
  );

  // Fund again and re-copy the SAME provider.
  await adminCreditUser(db, { userId, amountUsd: 100 });
  const copy2 = await allocate(db, { userId, providerId: pid2, amount: 100 });
  check("copy #2 ok", copy2.ok);
  check(
    "re-copy tops up the same allocation (no duplicate row)",
    copy1.ok && copy2.ok && copy1.allocationId === copy2.allocationId,
  );
  const activeForPid2 = (await listAllocations(db, userId)).filter(
    (r) => r.allocation.status === "active" && r.allocation.providerId === pid2,
  );
  check("exactly one active allocation for the provider", activeForPid2.length === 1, `(${activeForPid2.length})`);
  check(
    "value is the new $100 only — lost capital did NOT come back",
    ((await activeAllocationValues(db, userId)).byProvider[pid2] ?? 0) === 10000,
    `(${(await activeAllocationValues(db, userId)).byProvider[pid2] ?? 0})`,
  );
  await assertLedgerBalanced(db, "after re-copy");

  /* --- Blown account is margin-called (stops trading) ------------------- */
  console.log("\nBlown account margin call");
  const prov3 = await createProvider(db, {
    name: "MC Test FX",
    strategy: "Test",
    feeBps: 2000,
    minInvestment: 100,
    verified: true,
  });
  const pid3 = prov3.ok ? prov3.id : "";
  check("mc provider created", prov3.ok);
  await adminCreditUser(db, { userId, amountUsd: 100 });
  const mcAlloc = await allocate(db, { userId, providerId: pid3, amount: 100 });
  const mcAllocId = mcAlloc.ok ? mcAlloc.allocationId : "";
  check("mc allocate ok", mcAlloc.ok);

  // Open a provider position → mirrors an open copy position onto the allocation.
  const mcPos = await openProviderPosition(db, {
    providerId: pid3,
    symbol: "BTCUSD",
    side: "buy",
    price: 100,
    sizePct: 0.5,
  });
  check("mc position mirrored to the allocation", mcPos.ok && mcPos.mirrors === 1);
  const openBefore = await db
    .select({ id: schema.copyPositions.id })
    .from(schema.copyPositions)
    .where(and(eq(schema.copyPositions.allocationId, mcAllocId), eq(schema.copyPositions.status, "open")));
  check("one open position before the blow", openBefore.length === 1);

  // Blow the allocation to $0.
  const [mcAcc] = await db
    .select({ id: schema.ledgerAccounts.id })
    .from(schema.ledgerAccounts)
    .where(
      and(
        eq(schema.ledgerAccounts.kind, "client_allocation"),
        eq(schema.ledgerAccounts.userId, userId),
        eq(schema.ledgerAccounts.providerId, pid3),
      ),
    )
    .limit(1);
  await post(db, {
    kind: "trade_pnl",
    reference: `mcblow:${userId}`,
    currency: "USD",
    legs: [
      { accountId: mcAcc!.id, amount: -10000 },
      { accountId: pnlAcc, amount: 10000 },
    ],
  });

  const voided = await liquidateBlownAllocations(db);
  check("margin call voided the open position", voided >= 1, `(${voided})`);
  const openAfter = await db
    .select({ id: schema.copyPositions.id })
    .from(schema.copyPositions)
    .where(and(eq(schema.copyPositions.allocationId, mcAllocId), eq(schema.copyPositions.status, "open")));
  check("no open positions left on the blown account", openAfter.length === 0);
  check(
    "blown account stays at $0 (did not revive)",
    ((await activeAllocationValues(db, userId)).byProvider[pid3] ?? 0) === 0,
  );
  await assertLedgerBalanced(db, "after margin call");

  /* --- Auto-blow aged accounts ------------------------------------------ */
  console.log("\nAuto-blow aged accounts");
  const prov4 = await createProvider(db, {
    name: "AutoBlow FX",
    strategy: "Test",
    feeBps: 2000,
    minInvestment: 100,
    verified: true,
  });
  const pid4 = prov4.ok ? prov4.id : "";
  await adminCreditUser(db, { userId, amountUsd: 100 });
  const abAlloc = await allocate(db, { userId, providerId: pid4, amount: 100 });
  const abAllocId = abAlloc.ok ? abAlloc.allocationId : "";
  check("auto-blow allocate ok", abAlloc.ok);

  // A fresh account is not blown by a 1-day threshold.
  await blowAgedAllocations(db, 1);
  check(
    "recent account is NOT auto-blown",
    ((await activeAllocationValues(db, userId)).byProvider[pid4] ?? 0) === 10000,
  );

  // Backdate its start to 2 days ago → it should blow.
  await db
    .update(schema.allocations)
    .set({ startedAt: new Date(Date.now() - 2 * 86_400_000) })
    .where(eq(schema.allocations.id, abAllocId));
  const abRes = await blowAgedAllocations(db, 1);
  check("aged account is auto-blown", abRes.blown >= 1, `(${abRes.blown})`);
  check(
    "aged account drained to $0",
    ((await activeAllocationValues(db, userId)).byProvider[pid4] ?? 0) === 0,
  );
  await assertLedgerBalanced(db, "after auto-blow");

  /* --- Admin manual fund ------------------------------------------------ */
  console.log("\nAdmin manual fund");
  const beforeFund = await clientCashBalance(db, userId);
  const fundRes = await adminCreditUser(db, { userId, amountUsd: 75, note: "test top-up" });
  check("admin fund succeeds", fundRes.ok);
  const afterFund = await clientCashBalance(db, userId);
  check(
    "admin fund credits $75.00 to the user's cash",
    afterFund - beforeFund === 7500,
    `(before ${beforeFund}, after ${afterFund})`,
  );
  check("admin fund rejects a non-positive amount", !(await adminCreditUser(db, { userId, amountUsd: 0 })).ok);
  await assertLedgerBalanced(db, "after admin manual fund");

  /* --- Crypto credits the actual received amount ------------------------ */
  console.log("\nCrypto actual-amount crediting");
  const beforeCrypto = await clientCashBalance(db, userId);
  const cryptoPid = await initiateDeposit(db, {
    userId,
    provider: "crypto",
    amount: 10000, // invoiced $100
    currency: "USD",
    creditedAmount: 10000,
    providerRequestId: "np_test_partial",
  });
  // The client actually sent only 63.50 USDT — credit that, not the $100 invoice.
  await confirmDeposit(db, {
    paymentId: cryptoPid,
    externalRef: "nowpay:np_test_partial",
    creditMinorOverride: 6350,
  });
  const afterCrypto = await clientCashBalance(db, userId);
  check(
    "crypto credits the actual received amount, not the invoice",
    afterCrypto - beforeCrypto === 6350,
    `(delta ${afterCrypto - beforeCrypto})`,
  );
  await assertLedgerBalanced(db, "after crypto actual-amount credit");

  // A partially_paid callback with 0 actually_paid must NOT credit the invoice
  // amount (the over-credit bug: $300 credited for 8.45 USDT received).
  const beforeZero = await clientCashBalance(db, userId);
  const zeroPid = await initiateDeposit(db, {
    userId,
    provider: "crypto",
    amount: 30000, // invoiced $300
    currency: "USD",
    creditedAmount: 30000,
    providerRequestId: "np_test_zero",
  });
  await confirmDeposit(db, {
    paymentId: zeroPid,
    externalRef: "nowpay:np_test_zero",
    creditMinorOverride: 0, // nothing actually arrived yet
  });
  check(
    "zero actually_paid credits nothing (no over-credit)",
    (await clientCashBalance(db, userId)) - beforeZero === 0,
    `(delta ${(await clientCashBalance(db, userId)) - beforeZero})`,
  );
  await assertLedgerBalanced(db, "after zero-amount crypto callback");

  /* --- Email verification ----------------------------------------------- */
  console.log("\nEmail verification");
  check("email unverified by default", !(await isEmailVerified(db, userId)));
  const evCode = await startEmailVerification(db, userId);
  check("verification code is 6 digits", /^\d{6}$/.test(evCode));
  const wrongCode = evCode === "111111" ? "222222" : "111111";
  check("wrong code is rejected", !(await verifyEmailCode(db, userId, wrongCode)).ok);
  check("correct code verifies", (await verifyEmailCode(db, userId, evCode)).ok);
  check("email now verified", await isEmailVerified(db, userId));

  /* --- Two-factor authentication ---------------------------------------- */
  console.log("\nTwo-factor authentication");
  const secret = generateSecret();
  check("TOTP: fresh secret is base32", /^[A-Z2-7]+$/.test(secret));
  check("TOTP: current code verifies", verifyTotp(secret, currentTotp(secret)));
  check("TOTP: wrong code rejected", !verifyTotp(secret, "000000"));

  check("2FA off by default", !(await is2FAEnabled(db, userId)));
  await begin2FASetup(db, userId, secret);
  const badEnable = await enable2FA(db, userId, "111111");
  check("2FA enable rejects a bad setup code", !badEnable.ok);
  const good = await enable2FA(db, userId, currentTotp(secret));
  check("2FA enable succeeds with a valid code", good.ok);
  check(
    "2FA enable returns 8 backup codes",
    good.ok && good.backupCodes.length === 8,
  );
  check("2FA now enabled", await is2FAEnabled(db, userId));
  check("2FA verify accepts a live TOTP", await verify2FA(db, userId, currentTotp(secret)));
  check("2FA verify rejects a wrong code", !(await verify2FA(db, userId, "000000")));

  if (good.ok) {
    const backup = good.backupCodes[0]!;
    check("2FA verify consumes a backup code", await verify2FA(db, userId, backup));
    check("2FA backup code can't be reused", !(await verify2FA(db, userId, backup)));
  }

  const badDisable = await disable2FA(db, userId, "000000");
  check("2FA disable rejects a bad code", !badDisable.ok);
  const okDisable = await disable2FA(db, userId, currentTotp(secret));
  check("2FA disable succeeds with a valid code", okDisable.ok);
  check("2FA off after disable", !(await is2FAEnabled(db, userId)));

  /* --- Summary ---------------------------------------------------------- */
  console.log(`\n${pass} passed, ${fail} failed\n`);
  await pg.close();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ==========================================================================
   PrimeStone database schema
   --------------------------------------------------------------------------
   The data model for a regulated copy-trading platform: identity, KYC, an
   immutable double-entry ledger for client money, payments, the owner-managed
   signal providers, and client allocations to them.

   Money is stored as integer minor units (cents) in a numeric column, never as
   a float — floats lose cents and you can never reconcile a floating-point
   ledger against a bank statement.
   ========================================================================== */

export const userRole = pgEnum("user_role", ["client", "admin", "owner"]);
export const kycStatus = pgEnum("kyc_status", [
  "unverified",
  "pending",
  "verified",
  "rejected",
]);
export const kycDocType = pgEnum("kyc_doc_type", [
  "id_front",
  "id_back",
  "selfie",
  "proof_of_address",
]);
export const accountKind = pgEnum("ledger_account_kind", [
  "client_cash", // a client's spendable balance
  "client_allocation", // funds a client has committed to a provider
  "system_deposits_clearing", // money received from a PSP, not yet client cash
  "system_withdrawals_clearing", // money leaving to a PSP
  "system_fees", // fees earned by the platform
  "system_pnl", // simulated trading P&L counterparty
]);
export const txnKind = pgEnum("ledger_txn_kind", [
  "deposit",
  "withdrawal",
  "allocation",
  "deallocation",
  "fee",
  "trade_pnl",
  "adjustment",
]);
export const paymentProvider = pgEnum("payment_provider", [
  "mpesa",
  "card",
  "crypto",
  "bank",
]);
export const paymentKind = pgEnum("payment_kind", ["deposit", "withdrawal"]);
export const paymentStatus = pgEnum("payment_status", [
  "initiated",
  "pending",
  "completed",
  "failed",
  "cancelled",
]);
export const allocationStatus = pgEnum("allocation_status", [
  "active",
  "paused",
  "closed",
]);
export const positionSide = pgEnum("position_side", ["buy", "sell"]);
export const positionStatus = pgEnum("position_status", ["open", "closed"]);

/* -------------------------------------------------------------------------- */
/*  Identity                                                                   */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    phone: text("phone").notNull().default(""),
    country: text("country").notNull().default(""),
    accountType: text("account_type").notNull().default("standard"),
    leverage: integer("leverage").notNull().default(500),
    role: userRole("role").notNull().default("client"),
    kycStatusCache: kycStatus("kyc_status_cache").notNull().default("unverified"),
    flagged: boolean("flagged").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Only the hash of the session token is stored; the raw token lives in the
    // client cookie and is never persisted server-side.
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_unique").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
  ],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Only the hash of the reset token is stored; the raw token is in the email link.
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("password_reset_token_hash_unique").on(t.tokenHash),
    index("password_reset_user_idx").on(t.userId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  KYC                                                                        */
/* -------------------------------------------------------------------------- */

export const kycProfiles = pgTable(
  "kyc_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: kycStatus("status").notNull().default("pending"),
    idType: text("id_type").notNull(),
    // The full id number is never stored in the clear: we keep a display mask
    // plus a salted hash for de-duplication / lookup only.
    idNumberMasked: text("id_number_masked").notNull(),
    idNumberHash: text("id_number_hash").notNull(),
    dateOfBirth: text("date_of_birth").notNull(),
    residentialAddress: text("residential_address").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    rejectionReason: text("rejection_reason"),
  },
  (t) => [uniqueIndex("kyc_profiles_user_unique").on(t.userId)],
);

export const kycDocuments = pgTable(
  "kyc_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: kycDocType("type").notNull(),
    // Key/URL in encrypted object storage (e.g. Vercel Blob / S3). The bytes
    // themselves never touch this database.
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    fileSize: bigint("file_size", { mode: "number" }).notNull(),
    contentType: text("content_type").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("kyc_documents_user_idx").on(t.userId)],
);

/* -------------------------------------------------------------------------- */
/*  Ledger — immutable double-entry                                            */
/* -------------------------------------------------------------------------- */

export const ledgerAccounts = pgTable(
  "ledger_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: accountKind("kind").notNull(),
    // Null for system accounts; set for per-client accounts.
    userId: uuid("user_id").references(() => users.id, { onDelete: "restrict" }),
    // For allocation accounts, which provider the funds are committed to.
    providerId: uuid("provider_id"),
    currency: text("currency").notNull().default("USD"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ledger_accounts_user_idx").on(t.userId, t.kind)],
);

export const ledgerTransactions = pgTable("ledger_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: txnKind("kind").notNull(),
  reference: text("reference").notNull(),
  memo: text("memo"),
  metadata: jsonb("metadata"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => ledgerTransactions.id, { onDelete: "restrict" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => ledgerAccounts.id, { onDelete: "restrict" }),
    // Signed minor units (cents). Positive = credit into the account, negative
    // = debit out of it. Every transaction's entries must sum to zero.
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("USD"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ledger_entries_account_idx").on(t.accountId),
    index("ledger_entries_txn_idx").on(t.transactionId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Payments                                                                   */
/* -------------------------------------------------------------------------- */

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    provider: paymentProvider("provider").notNull(),
    kind: paymentKind("kind").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(), // charged amount, minor units (e.g. KES)
    feeAmount: bigint("fee_amount", { mode: "number" }).notNull().default(0),
    currency: text("currency").notNull().default("USD"), // currency of `amount`
    // What actually hit the account (USD minor) and the FX rate used to convert.
    creditedAmount: bigint("credited_amount", { mode: "number" }),
    fxRate: numeric("fx_rate", { precision: 14, scale: 6 }),
    status: paymentStatus("status").notNull().default("initiated"),
    // Idempotency: a PSP reference (e.g. M-Pesa receipt) is unique, so a
    // retried callback can never credit an account twice.
    externalRef: text("external_ref"),
    providerRequestId: text("provider_request_id"),
    destination: text("destination"),
    rawCallback: jsonb("raw_callback"),
    ledgerTransactionId: uuid("ledger_transaction_id").references(
      () => ledgerTransactions.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("payments_external_ref_unique").on(t.externalRef),
    index("payments_user_idx").on(t.userId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Signal providers (owner-managed) and client allocations                    */
/* -------------------------------------------------------------------------- */

export const signalProviders = pgTable(
  "signal_providers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    handle: text("handle").notNull().default(""),
    strategy: text("strategy").notNull().default(""),
    bio: text("bio").notNull().default(""),
    country: text("country").notNull().default(""),
    // Performance figures the owner publishes for the provider.
    roi12m: numeric("roi_12m", { precision: 8, scale: 2 }).notNull().default("0"),
    winRate: numeric("win_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    maxDrawdown: numeric("max_drawdown", { precision: 5, scale: 2 }).notNull().default("0"),
    // Performance fee in basis points (e.g. 2000 = 20%).
    feeBps: integer("fee_bps").notNull().default(2000),
    minInvestment: bigint("min_investment", { mode: "number" }).notNull().default(0),
    verified: boolean("verified").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("signal_providers_slug_unique").on(t.slug)],
);

export const allocations = pgTable(
  "allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => signalProviders.id, { onDelete: "restrict" }),
    amount: bigint("amount", { mode: "number" }).notNull(), // committed minor units
    riskMultiplier: numeric("risk_multiplier", { precision: 4, scale: 2 })
      .notNull()
      .default("1"),
    copyStopLossBps: integer("copy_stop_loss_bps"),
    status: allocationStatus("status").notNull().default("active"),
    realizedPnl: bigint("realized_pnl", { mode: "number" }).notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    index("allocations_user_idx").on(t.userId),
    index("allocations_provider_idx").on(t.providerId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Copy trading — provider positions and their per-allocation mirrors         */
/* -------------------------------------------------------------------------- */

/**
 * A position opened by a signal provider. This is the SIGNAL: symbol, side,
 * the real entry price it was opened at, and `sizePct` — the fraction of each
 * subscriber's allocation this position commits. When it closes at a real exit
 * price, every mirror settles against the ledger.
 *
 * Prices are stored as decimal strings (numeric) because instruments span many
 * orders of magnitude (JPY pairs to Bitcoin); money still settles as integer
 * USD minor units in the ledger.
 */
export const providerPositions = pgTable(
  "provider_positions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => signalProviders.id, { onDelete: "restrict" }),
    symbol: text("symbol").notNull(),
    side: positionSide("side").notNull(),
    entryPrice: numeric("entry_price", { precision: 20, scale: 8 }).notNull(),
    // Fraction of each subscriber's allocation committed (e.g. 0.05 = 5%).
    sizePct: numeric("size_pct", { precision: 6, scale: 4 }).notNull(),
    // Stop-loss / take-profit as a fraction of the entry price (e.g. 0.015 = 1.5%).
    stopLossPct: numeric("stop_loss_pct", { precision: 6, scale: 4 }),
    takeProfitPct: numeric("take_profit_pct", { precision: 6, scale: 4 }),
    status: positionStatus("status").notNull().default("open"),
    exitPrice: numeric("exit_price", { precision: 20, scale: 8 }),
    closeReason: text("close_reason"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    index("provider_positions_provider_idx").on(t.providerId, t.status),
    index("provider_positions_status_idx").on(t.status),
  ],
);

/**
 * One subscriber's mirror of a provider position, sized to their allocation.
 * `stakeMinor` is the USD (minor units) put behind this trade. Realized P&L is
 * `stakeMinor * (exit-entry)/entry * direction`, clamped so a single position
 * can never lose more than its stake.
 */
export const copyPositions = pgTable(
  "copy_positions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerPositionId: uuid("provider_position_id")
      .notNull()
      .references(() => providerPositions.id, { onDelete: "restrict" }),
    allocationId: uuid("allocation_id")
      .notNull()
      .references(() => allocations.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    symbol: text("symbol").notNull(),
    side: positionSide("side").notNull(),
    entryPrice: numeric("entry_price", { precision: 20, scale: 8 }).notNull(),
    stakeMinor: bigint("stake_minor", { mode: "number" }).notNull(),
    status: positionStatus("status").notNull().default("open"),
    exitPrice: numeric("exit_price", { precision: 20, scale: 8 }),
    realizedPnl: bigint("realized_pnl", { mode: "number" }).notNull().default(0),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    index("copy_positions_user_idx").on(t.userId, t.status),
    index("copy_positions_alloc_idx").on(t.allocationId),
    index("copy_positions_provider_pos_idx").on(t.providerPositionId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Audit log — who did what, for compliance                                   */
/* -------------------------------------------------------------------------- */

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id").references(() => users.id),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_actor_idx").on(t.actorId)],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type SignalProviderRow = typeof signalProviders.$inferSelect;
export type AllocationRow = typeof allocations.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
export type ProviderPositionRow = typeof providerPositions.$inferSelect;
export type CopyPositionRow = typeof copyPositions.$inferSelect;

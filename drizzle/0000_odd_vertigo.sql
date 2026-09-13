CREATE TYPE "public"."ledger_account_kind" AS ENUM('client_cash', 'client_allocation', 'system_deposits_clearing', 'system_withdrawals_clearing', 'system_fees', 'system_pnl');--> statement-breakpoint
CREATE TYPE "public"."allocation_status" AS ENUM('active', 'paused', 'closed');--> statement-breakpoint
CREATE TYPE "public"."kyc_doc_type" AS ENUM('id_front', 'id_back', 'selfie', 'proof_of_address');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('unverified', 'pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."payment_kind" AS ENUM('deposit', 'withdrawal');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('mpesa', 'card', 'crypto', 'bank');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('initiated', 'pending', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ledger_txn_kind" AS ENUM('deposit', 'withdrawal', 'allocation', 'deallocation', 'fee', 'trade_pnl', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('client', 'admin', 'owner');--> statement-breakpoint
CREATE TABLE "allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"risk_multiplier" numeric(4, 2) DEFAULT '1' NOT NULL,
	"copy_stop_loss_bps" integer,
	"status" "allocation_status" DEFAULT 'active' NOT NULL,
	"realized_pnl" bigint DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "kyc_doc_type" NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" bigint NOT NULL,
	"content_type" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "kyc_status" DEFAULT 'pending' NOT NULL,
	"id_type" text NOT NULL,
	"id_number_masked" text NOT NULL,
	"id_number_hash" text NOT NULL,
	"date_of_birth" text NOT NULL,
	"residential_address" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"rejection_reason" text
);
--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "ledger_account_kind" NOT NULL,
	"user_id" uuid,
	"provider_id" uuid,
	"currency" text DEFAULT 'USD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "ledger_txn_kind" NOT NULL,
	"reference" text NOT NULL,
	"memo" text,
	"metadata" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"kind" "payment_kind" NOT NULL,
	"amount" bigint NOT NULL,
	"fee_amount" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" "payment_status" DEFAULT 'initiated' NOT NULL,
	"external_ref" text,
	"provider_request_id" text,
	"destination" text,
	"raw_callback" jsonb,
	"ledger_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"handle" text DEFAULT '' NOT NULL,
	"strategy" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"roi_12m" numeric(8, 2) DEFAULT '0' NOT NULL,
	"win_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"max_drawdown" numeric(5, 2) DEFAULT '0' NOT NULL,
	"fee_bps" integer DEFAULT 2000 NOT NULL,
	"min_investment" bigint DEFAULT 0 NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"account_type" text DEFAULT 'standard' NOT NULL,
	"leverage" integer DEFAULT 500 NOT NULL,
	"role" "user_role" DEFAULT 'client' NOT NULL,
	"kyc_status_cache" "kyc_status" DEFAULT 'unverified' NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_provider_id_signal_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."signal_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_profiles" ADD CONSTRAINT "kyc_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_profiles" ADD CONSTRAINT "kyc_profiles_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_ledger_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("ledger_transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "allocations_user_idx" ON "allocations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "allocations_provider_idx" ON "allocations" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "kyc_documents_user_idx" ON "kyc_documents" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kyc_profiles_user_unique" ON "kyc_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ledger_accounts_user_idx" ON "ledger_accounts" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "ledger_entries_account_idx" ON "ledger_entries" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_txn_idx" ON "ledger_entries" USING btree ("transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_external_ref_unique" ON "payments" USING btree ("external_ref");--> statement-breakpoint
CREATE INDEX "payments_user_idx" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "signal_providers_slug_unique" ON "signal_providers" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");
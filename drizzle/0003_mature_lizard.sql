CREATE TYPE "public"."position_side" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TYPE "public"."position_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "copy_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_position_id" uuid NOT NULL,
	"allocation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"side" "position_side" NOT NULL,
	"entry_price" numeric(20, 8) NOT NULL,
	"stake_minor" bigint NOT NULL,
	"status" "position_status" DEFAULT 'open' NOT NULL,
	"exit_price" numeric(20, 8),
	"realized_pnl" bigint DEFAULT 0 NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "provider_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"side" "position_side" NOT NULL,
	"entry_price" numeric(20, 8) NOT NULL,
	"size_pct" numeric(6, 4) NOT NULL,
	"stop_loss_pct" numeric(6, 4),
	"take_profit_pct" numeric(6, 4),
	"status" "position_status" DEFAULT 'open' NOT NULL,
	"exit_price" numeric(20, 8),
	"close_reason" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "copy_positions" ADD CONSTRAINT "copy_positions_provider_position_id_provider_positions_id_fk" FOREIGN KEY ("provider_position_id") REFERENCES "public"."provider_positions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_positions" ADD CONSTRAINT "copy_positions_allocation_id_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."allocations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_positions" ADD CONSTRAINT "copy_positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_positions" ADD CONSTRAINT "provider_positions_provider_id_signal_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."signal_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "copy_positions_user_idx" ON "copy_positions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "copy_positions_alloc_idx" ON "copy_positions" USING btree ("allocation_id");--> statement-breakpoint
CREATE INDEX "copy_positions_provider_pos_idx" ON "copy_positions" USING btree ("provider_position_id");--> statement-breakpoint
CREATE INDEX "provider_positions_provider_idx" ON "provider_positions" USING btree ("provider_id","status");--> statement-breakpoint
CREATE INDEX "provider_positions_status_idx" ON "provider_positions" USING btree ("status");
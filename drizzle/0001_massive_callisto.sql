ALTER TABLE "payments" ADD COLUMN "credited_amount" bigint;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "fx_rate" numeric(14, 6);
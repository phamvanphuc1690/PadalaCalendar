CREATE TYPE "public"."invoice_status" AS ENUM('pending', 'paid', 'settling', 'settled', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."payment_chain" AS ENUM('stellar');--> statement-breakpoint
CREATE TYPE "public"."payment_intent_status" AS ENUM('awaiting', 'detected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_memo_type" AS ENUM('text', 'id', 'hash', 'return');--> statement-breakpoint
CREATE TYPE "public"."payout_method" AS ENUM('bank_deposit', 'cash_pickup');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_status" AS ENUM('quoted', 'submitted', 'processing', 'completed', 'refunded', 'expired', 'failed');--> statement-breakpoint
CREATE TABLE "anchor_endpoints" (
	"domain" text PRIMARY KEY NOT NULL,
	"transfer_server_sep24" text,
	"quote_server_sep38" text,
	"web_auth_endpoint" text,
	"signing_key" text,
	"network_passphrase" text,
	"supported_assets" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ttl_seconds" text DEFAULT '3600' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" text NOT NULL,
	"route" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" text NOT NULL,
	"response_body" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"amount_minor" text NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"description" text,
	"status" "invoice_status" DEFAULT 'pending' NOT NULL,
	"signed_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"destination_address" text NOT NULL,
	"destination_memo" text,
	"network" text DEFAULT 'testnet' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_signed_id_unique" UNIQUE("signed_id")
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"wallet_address" text NOT NULL,
	"network" text DEFAULT 'testnet' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
CREATE TABLE "payment_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"chain" "payment_chain" NOT NULL,
	"expected_amount_minor" text NOT NULL,
	"status" "payment_intent_status" DEFAULT 'awaiting' NOT NULL,
	"detected_at" timestamp with time zone,
	"source_tx_hash" text,
	"stellar_payment_id" text,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"anchor_domain" text NOT NULL,
	"anchor_quote_id" text,
	"sell_asset" text NOT NULL,
	"buy_asset" text NOT NULL,
	"sell_amount" text NOT NULL,
	"buy_amount" text NOT NULL,
	"total_price" text NOT NULL,
	"price" text NOT NULL,
	"fee_total" text NOT NULL,
	"fee_asset" text NOT NULL,
	"buy_delivery_method" text,
	"sell_delivery_method" text,
	"country_code" text,
	"context" text,
	"raw_response" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount_minor" text NOT NULL,
	"merchant_wallet" text NOT NULL,
	"stellar_tx_hash" text,
	"stellar_payment_id" text,
	"ledger" text,
	"status" "settlement_status" DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"actor" text NOT NULL,
	"reason" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"quote_id" uuid,
	"anchor_domain" text NOT NULL,
	"source_amount_minor" text NOT NULL,
	"destination_asset" text NOT NULL,
	"destination_amount" text NOT NULL,
	"payout_method" "payout_method" NOT NULL,
	"payout_meta" jsonb NOT NULL,
	"status" "withdrawal_status" DEFAULT 'quoted' NOT NULL,
	"anchor_tx_id" text,
	"withdraw_anchor_account" text,
	"withdraw_memo" text,
	"withdraw_memo_type" "withdrawal_memo_type" DEFAULT 'text',
	"stellar_tx_hash" text,
	"version" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idempotency_keys_pk" ON "idempotency_keys" USING btree ("key","route");--> statement-breakpoint
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "invoices_merchant_idx" ON "invoices" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_merchant_status_created_idx" ON "invoices" USING btree ("merchant_id","status","created_at");--> statement-breakpoint
CREATE INDEX "payment_intents_invoice_idx" ON "payment_intents" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_intents_chain_tx_uniq" ON "payment_intents" USING btree ("chain","source_tx_hash");--> statement-breakpoint
CREATE INDEX "quotes_merchant_idx" ON "quotes" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "settlements_invoice_idx" ON "settlements" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "state_transitions_entity_idx" ON "state_transitions" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "withdrawals_merchant_idx" ON "withdrawals" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "withdrawals_status_idx" ON "withdrawals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "withdrawals_anchor_tx_idx" ON "withdrawals" USING btree ("anchor_domain","anchor_tx_id");
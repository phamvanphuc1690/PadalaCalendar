ALTER TYPE "public"."payment_chain" ADD VALUE 'base';--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_id" text NOT NULL,
	"message" text NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"dismissed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remittances" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_id" text NOT NULL,
	"pickup_ref" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"tx_hash" text,
	"amount_usdc" text DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipients" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_address" text NOT NULL,
	"corridor" text DEFAULT 'PH' NOT NULL,
	"monthly_amount_usdc" text NOT NULL,
	"send_day_of_month" integer NOT NULL,
	"sender_name" text NOT NULL,
	"kyc_verified" boolean DEFAULT false NOT NULL,
	"pickup_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sep24_withdrawals" (
	"id" text PRIMARY KEY NOT NULL,
	"remittance_id" text NOT NULL,
	"anchor_tx_id" text NOT NULL,
	"amount_php" integer NOT NULL,
	"pickup_code" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wallets" DROP CONSTRAINT "wallets_public_key_unique";--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "evm_tx_hash" text;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "evm_from_address" text;--> statement-breakpoint
ALTER TABLE "wallets" ADD COLUMN "owner_public_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."recipients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remittances" ADD CONSTRAINT "remittances_recipient_id_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."recipients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sep24_withdrawals" ADD CONSTRAINT "sep24_withdrawals_remittance_id_remittances_id_fk" FOREIGN KEY ("remittance_id") REFERENCES "public"."remittances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wallets_owner_idx" ON "wallets" USING btree ("owner_public_key");--> statement-breakpoint
CREATE INDEX "wallets_owner_public_key_uniq" ON "wallets" USING btree ("owner_public_key","public_key");
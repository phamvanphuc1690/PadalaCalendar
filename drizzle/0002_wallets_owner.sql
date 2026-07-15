-- Add owner_public_key for row-level isolation; drop old global unique on public_key
ALTER TABLE "wallets" ADD COLUMN "owner_public_key" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "wallets" DROP CONSTRAINT IF EXISTS "wallets_public_key_unique";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallets_owner_idx" ON "wallets" ("owner_public_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wallets_owner_public_key_uniq" ON "wallets" ("owner_public_key", "public_key");--> statement-breakpoint
ALTER TABLE "wallets" ALTER COLUMN "owner_public_key" DROP DEFAULT;

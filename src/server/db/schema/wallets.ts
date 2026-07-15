import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const wallets = pgTable(
  'wallets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerPublicKey: text('owner_public_key').notNull(),
    publicKey: text('public_key').notNull(),
    label: text('label').notNull(),
    network: text('network').notNull().default('testnet'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    publicKeyIdx: index('wallets_public_key_idx').on(t.publicKey),
    ownerIdx: index('wallets_owner_idx').on(t.ownerPublicKey),
    ownerPublicKeyUniq: index('wallets_owner_public_key_uniq').on(t.ownerPublicKey, t.publicKey),
  }),
);

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;

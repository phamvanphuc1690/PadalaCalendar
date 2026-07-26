import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const merchants = pgTable('merchants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  walletAddress: text('wallet_address').notNull().unique(),
  network: text('network').notNull().default('testnet'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Merchant = typeof merchants.$inferSelect;
export type NewMerchant = typeof merchants.$inferInsert;

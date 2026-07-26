import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { recipients } from './recipients';

export const remittances = pgTable('remittances', {
  id: text('id').primaryKey(),
  recipientId: text('recipient_id')
    .notNull()
    .references(() => recipients.id),
  amountUsdc: text('amount_usdc').notNull(),
  status: text('status').notNull().default('scheduled'),
  txHash: text('tx_hash'),
  pickupRef: text('pickup_ref'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Remittance = typeof remittances.$inferSelect;
export type NewRemittance = typeof remittances.$inferInsert;

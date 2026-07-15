import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { recipients } from './recipients';

// Payments alias — maps to the 'remittances' table.
// Completed remittances (status='completed') with tx_hash are the payments.
export const payments = pgTable('remittances', {
  id: text('id').primaryKey(),
  recipientId: text('recipient_id')
    .notNull()
    .references(() => recipients.id),
  amountUsdc: text('amount_usdc').notNull().default('0'),
  txHash: text('tx_hash').notNull().default(''),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

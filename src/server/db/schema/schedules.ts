import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { recipients } from './recipients';

// Maps to the actual 'remittances' DB table.
// Each remittance row is a scheduled/completed monthly padala.
export const schedules = pgTable('remittances', {
  id: text('id').primaryKey(),
  recipientId: text('recipient_id')
    .notNull()
    .references(() => recipients.id),
  cycleLabel: text('pickup_ref'),
  dueDate: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  status: text('status').notNull().default('upcoming'),
  txHash: text('tx_hash'),
  amountUsdc: text('amount_usdc').notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;

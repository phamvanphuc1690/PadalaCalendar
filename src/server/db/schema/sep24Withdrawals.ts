import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { remittances } from './remittances';

export const sep24Withdrawals = pgTable('sep24_withdrawals', {
  id: text('id').primaryKey(),
  remittanceId: text('remittance_id')
    .notNull()
    .references(() => remittances.id),
  anchorTxId: text('anchor_tx_id').notNull(),
  amountPhp: integer('amount_php').notNull(),
  pickupCode: text('pickup_code').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Sep24Withdrawal = typeof sep24Withdrawals.$inferSelect;
export type NewSep24Withdrawal = typeof sep24Withdrawals.$inferInsert;

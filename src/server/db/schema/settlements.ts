import { index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { invoices } from './invoices';

export const SETTLEMENT_STATUSES = ['pending', 'completed', 'failed'] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const settlementStatusEnum = pgEnum('settlement_status', SETTLEMENT_STATUSES);

/**
 * Tracks the on-chain confirmation of a payment that has landed in the
 * merchant's wallet. The hub does not submit a transaction here — payment
 * flows directly from the customer to the merchant. The settlement row is
 * a confirmation/audit record.
 */
export const settlements = pgTable(
  'settlements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    amountMinor: text('amount_minor').notNull(),
    merchantWallet: text('merchant_wallet').notNull(),
    stellarTxHash: text('stellar_tx_hash'),
    stellarPaymentId: text('stellar_payment_id'),
    ledger: text('ledger'),
    status: settlementStatusEnum('status').notNull().default('pending'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    invoiceIdx: index('settlements_invoice_idx').on(t.invoiceId),
  }),
);

export type Settlement = typeof settlements.$inferSelect;
export type NewSettlement = typeof settlements.$inferInsert;

import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { invoices } from './invoices';

export const PAYMENT_CHAINS = ['stellar', 'base'] as const;
export type PaymentChain = (typeof PAYMENT_CHAINS)[number];

export const paymentChainEnum = pgEnum('payment_chain', PAYMENT_CHAINS);

export const PAYMENT_INTENT_STATUSES = ['awaiting', 'detected', 'failed'] as const;
export type PaymentIntentStatus = (typeof PAYMENT_INTENT_STATUSES)[number];

export const paymentIntentStatusEnum = pgEnum('payment_intent_status', PAYMENT_INTENT_STATUSES);

/**
 * A payment_intent represents the expected chain/payment for an invoice.
 * Multiple intents per invoice are supported (e.g. one for Stellar USDC, one
 * for cross-chain). The unique index on `(chain, source_tx_hash)` prevents
 * double-counting a single on-chain payment.
 */
export const paymentIntents = pgTable(
  'payment_intents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    chain: paymentChainEnum('chain').notNull(),
    expectedAmountMinor: text('expected_amount_minor').notNull(),
    status: paymentIntentStatusEnum('status').notNull().default('awaiting'),
    detectedAt: timestamp('detected_at', { withTimezone: true }),
    sourceTxHash: text('source_tx_hash'),
    stellarPaymentId: text('stellar_payment_id'),
    evmTxHash: text('evm_tx_hash'),
    evmFromAddress: text('evm_from_address'),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    invoiceIdx: index('payment_intents_invoice_idx').on(t.invoiceId),
    txHashUniq: uniqueIndex('payment_intents_chain_tx_uniq').on(t.chain, t.sourceTxHash),
  }),
);

export type PaymentIntent = typeof paymentIntents.$inferSelect;
export type NewPaymentIntent = typeof paymentIntents.$inferInsert;

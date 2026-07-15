import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { merchants } from './merchants';

export const INVOICE_STATUSES = [
  'pending',
  'paid',
  'settling',
  'settled',
  'failed',
  'expired',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const invoiceStatusEnum = pgEnum('invoice_status', INVOICE_STATUSES);

/**
 * Single source of truth for an invoice. Amounts are stored as
 * `text` of minor units (USDC = 6 decimals) so JSON round-trips cleanly
 * and `bigint` arithmetic does not lose precision.
 */
export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    amountMinor: text('amount_minor').notNull(),
    currency: text('currency').notNull().default('USD'),
    description: text('description'),
    status: invoiceStatusEnum('status').notNull().default('pending'),
    signedId: text('signed_id').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    /** Stellar destination address the customer must pay. */
    destinationAddress: text('destination_address').notNull(),
    destinationMemo: text('destination_memo'),
    network: text('network').notNull().default('testnet'),
    /** Monotonically incremented on every transition; SSE clients use it to dedupe. */
    version: integer('version').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    merchantIdx: index('invoices_merchant_idx').on(t.merchantId),
    statusIdx: index('invoices_status_idx').on(t.status),
    merchantStatusCreatedIdx: index('invoices_merchant_status_created_idx').on(
      t.merchantId,
      t.status,
      t.createdAt,
    ),
  }),
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

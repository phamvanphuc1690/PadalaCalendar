import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { merchants } from './merchants';
import { quotes } from './quotes';

export const WITHDRAWAL_STATUSES = [
  'quoted',
  'submitted',
  'processing',
  'completed',
  'refunded',
  'expired',
  'failed',
] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

export const withdrawalStatusEnum = pgEnum('withdrawal_status', WITHDRAWAL_STATUSES);

export const PAYOUT_METHODS = ['bank_deposit', 'cash_pickup'] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export const payoutMethodEnum = pgEnum('payout_method', PAYOUT_METHODS);

export const MEMO_TYPES = ['text', 'id', 'hash', 'return'] as const;
export type MemoType = (typeof MEMO_TYPES)[number];

export const memoTypeEnum = pgEnum('withdrawal_memo_type', MEMO_TYPES);

/**
 * Versioned payout metadata. Shape is one of:
 *   { v: 1, kind: 'bank_deposit', data: { bankName, accountNumber, accountName } }
 *   { v: 1, kind: 'cash_pickup',  data: { pickupLocation, recipientName, recipientId } }
 */
export type PayoutMeta =
  | {
      v: 1;
      kind: 'bank_deposit';
      data: { bankName: string; accountNumber: string; accountName: string };
    }
  | {
      v: 1;
      kind: 'cash_pickup';
      data: { pickupLocation: string; recipientName: string; recipientId?: string };
    };

export const withdrawals = pgTable(
  'withdrawals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    quoteId: uuid('quote_id').references(() => quotes.id, { onDelete: 'set null' }),
    anchorDomain: text('anchor_domain').notNull(),
    sourceAmountMinor: text('source_amount_minor').notNull(),
    destinationAsset: text('destination_asset').notNull(),
    destinationAmount: text('destination_amount').notNull(),
    payoutMethod: payoutMethodEnum('payout_method').notNull(),
    payoutMeta: jsonb('payout_meta').$type<PayoutMeta>().notNull(),
    status: withdrawalStatusEnum('status').notNull().default('quoted'),
    anchorTxId: text('anchor_tx_id'),
    withdrawAnchorAccount: text('withdraw_anchor_account'),
    withdrawMemo: text('withdraw_memo'),
    withdrawMemoType: memoTypeEnum('withdraw_memo_type').default('text'),
    stellarTxHash: text('stellar_tx_hash'),
    version: integer('version').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    merchantIdx: index('withdrawals_merchant_idx').on(t.merchantId),
    statusIdx: index('withdrawals_status_idx').on(t.status),
    anchorTxUniq: index('withdrawals_anchor_tx_idx').on(t.anchorDomain, t.anchorTxId),
  }),
);

export type Withdrawal = typeof withdrawals.$inferSelect;
export type NewWithdrawal = typeof withdrawals.$inferInsert;

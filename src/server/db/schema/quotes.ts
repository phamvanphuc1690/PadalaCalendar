import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { merchants } from './merchants';

export const quotes = pgTable(
  'quotes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    anchorDomain: text('anchor_domain').notNull(),
    anchorQuoteId: text('anchor_quote_id'),
    sellAsset: text('sell_asset').notNull(),
    buyAsset: text('buy_asset').notNull(),
    sellAmount: text('sell_amount').notNull(),
    buyAmount: text('buy_amount').notNull(),
    totalPrice: text('total_price').notNull(),
    price: text('price').notNull(),
    feeTotal: text('fee_total').notNull(),
    feeAsset: text('fee_asset').notNull(),
    buyDeliveryMethod: text('buy_delivery_method'),
    sellDeliveryMethod: text('sell_delivery_method'),
    countryCode: text('country_code'),
    context: text('context'),
    rawResponse: jsonb('raw_response'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    merchantIdx: index('quotes_merchant_idx').on(t.merchantId),
  }),
);

export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;

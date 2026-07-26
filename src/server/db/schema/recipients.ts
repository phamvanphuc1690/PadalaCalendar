import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const recipients = pgTable('recipients', {
  id: text('id').primaryKey(),
  name: text('recipient_name').notNull(),
  stellarAddress: text('recipient_address').notNull(),
  corridor: text('corridor').notNull().default('PH'),
  monthlyAmountUsdc: text('monthly_amount_usdc').notNull(),
  sendDay: integer('send_day_of_month').notNull(),
  relationship: text('sender_name').notNull(),
  kycVerified: boolean('kyc_verified').notNull().default(false),
  pickupRef: text('pickup_ref'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Recipient = typeof recipients.$inferSelect;
export type NewRecipient = typeof recipients.$inferInsert;

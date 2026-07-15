import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { recipients } from './recipients';

// horizonEvents alias — maps to the 'notifications' DB table.
// Notifications shown as live activity feed on the history page.
export const horizonEvents = pgTable('notifications', {
  id: text('id').primaryKey(),
  recipientId: text('recipient_id').references(() => recipients.id),
  // The notification message becomes the eventType label in the feed
  eventType: text('message').notNull().default('notification'),
  dismissed: boolean('dismissed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type HorizonEvent = typeof horizonEvents.$inferSelect;
export type NewHorizonEvent = typeof horizonEvents.$inferInsert;

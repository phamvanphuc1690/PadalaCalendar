import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { recipients } from './recipients';

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  recipientId: text('recipient_id')
    .notNull()
    .references(() => recipients.id),
  message: text('message').notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  dismissed: boolean('dismissed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

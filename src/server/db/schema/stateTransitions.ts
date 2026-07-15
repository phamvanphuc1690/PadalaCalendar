import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const STATE_TRANSITION_ACTORS = ['system', 'merchant', 'customer', 'anchor'] as const;
export type StateTransitionActor = (typeof STATE_TRANSITION_ACTORS)[number];

/**
 * Append-only audit log for invoice and withdrawal state transitions.
 * Useful for "why did this settle?" debugging and post-mortem analysis.
 */
export const stateTransitions = pgTable(
  'state_transitions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    fromStatus: text('from_status').notNull(),
    toStatus: text('to_status').notNull(),
    actor: text('actor').notNull().$type<StateTransitionActor>(),
    reason: text('reason'),
    meta: jsonb('meta'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    entityIdx: index('state_transitions_entity_idx').on(t.entityType, t.entityId, t.createdAt),
  }),
);

export type StateTransition = typeof stateTransitions.$inferSelect;
export type NewStateTransition = typeof stateTransitions.$inferInsert;

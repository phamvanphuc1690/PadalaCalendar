import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const anchorEndpoints = pgTable('anchor_endpoints', {
  domain: text('domain').primaryKey(),
  transferServerSep24: text('transfer_server_sep24'),
  quoteServerSep38: text('quote_server_sep38'),
  webAuthEndpoint: text('web_auth_endpoint'),
  signingKey: text('signing_key'),
  networkPassphrase: text('network_passphrase'),
  supportedAssets: jsonb('supported_assets'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
  ttlSeconds: text('ttl_seconds').notNull().default('3600'),
});

export type AnchorEndpoint = typeof anchorEndpoints.$inferSelect;
export type NewAnchorEndpoint = typeof anchorEndpoints.$inferInsert;

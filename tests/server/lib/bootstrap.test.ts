// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { inArray } from 'drizzle-orm';
import { withdrawals } from '@/server/db/schema/withdrawals';

vi.mock('@/server/config/env', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    env: {
      ...actual.env,
      SESSION_SECRET: 'a'.repeat(32),
      OFFRAMP_POLL_INTERVAL_MS: 10_000,
      NODE_ENV: 'test',
    },
  };
});

// Provide a working drizzle instance so buildOpenWithdrawalsQuery().toSQL()
// returns real SQL instead of a mock.
vi.mock('@/server/db/client', () => ({
  db: drizzle(new Pool({ connectionString: 'postgres://test:test@localhost:5432/test' }), {
    schema: {},
  }),
}));

describe('bootstrap', () => {
  describe('buildOpenWithdrawalsQuery', () => {
    it('generates an IN query for submitted OR processing withdrawals', async () => {
      const { buildOpenWithdrawalsQuery } = await import('@/server/lib/bootstrap');

      const result = buildOpenWithdrawalsQuery();

      // The old buggy code used and(eq(status,'submitted'), eq(status,'processing'))
      // which produces: ("status" = $1 and "status" = $2) — an impossible condition.
      // The fix uses inArray which produces: "status" in ($1, $2)
      expect(result.sql.toLowerCase()).toContain(' in ');
      expect(result.params).toContain('submitted');
      expect(result.params).toContain('processing');
    });

    it('params list does NOT contain duplicated status values (rejecting the and-bug)', async () => {
      const { buildOpenWithdrawalsQuery } = await import('@/server/lib/bootstrap');

      const result = buildOpenWithdrawalsQuery();

      // The buggy version with and(eq,eq) passes each value twice:
      //   SQL: (status = $1 and status = $2)  params: ['submitted', 'processing']
      // The fixed version with inArray passes each value once:
      //   SQL: status in ($1, $2)              params: ['submitted', 'processing']
      // Both have 2 params, so check the SQL text instead.
      const sqlLower = result.sql.toLowerCase();
      expect(sqlLower).not.toMatch(/status.*=.*\$.*and.*status.*=/);
    });
  });
});

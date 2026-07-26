// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mock state. `vi.hoisted` runs before the file's imports, so
// the `vi.mock` factory can close over these refs without triggering
// vitest's "top-level variables in factory" error.
//
// Each `db.select()` call returns a Promise augmented with chain methods.
// The chain methods all return the same Promise, so awaiting any point
// along the chain resolves to the same value. The Promise already has
// `then` from its prototype (not an own property), which keeps biome's
// `noThenProperty` rule happy.
const mocks = vi.hoisted(() => {
  type Chainable<T> = Promise<T> & {
    from: () => Chainable<T>;
    innerJoin: () => Chainable<T>;
    where: () => Chainable<T>;
    groupBy: () => Chainable<T>;
    orderBy: () => Chainable<T>;
    limit: () => Chainable<T>;
  };
  function makeSelectable<T>(value: T): Chainable<T> {
    const p = Promise.resolve(value) as Chainable<T>;
    p.from = () => p;
    p.innerJoin = () => p;
    p.where = () => p;
    p.groupBy = () => p;
    p.orderBy = () => p;
    p.limit = () => p;
    return p;
  }
  // Per-call builders, dispatched by call order to match the service's
  // three `db.select(...)` invocations:
  //   1. invoice counts
  //   2. settlement count
  //   3. recent settlements
  let callIndex = 0;
  const db = {
    select: vi.fn(() => {
      callIndex += 1;
      if (callIndex === 1) return makeSelectable(invoiceCounts);
      if (callIndex === 2) return makeSelectable(txCountRow);
      if (callIndex === 3) return makeSelectable(recentSettlements);
      return makeSelectable([]);
    }),
  };
  const reset = () => {
    callIndex = 0;
  };
  return { db, reset };
});

vi.mock('@/server/db/client', () => ({ db: mocks.db }));

// Mock merchantService so we don't have to thread the db calls through
// `ensureFromPublicKey`. The mock simply returns the fixture row.
vi.mock('@/server/service/merchant.service', () => ({
  merchantService: {
    ensureFromPublicKey: vi.fn(async () => MERCHANT_ROW_FIXTURE),
  },
}));

import { statsService } from '@/server/service/stats.service';

const MERCHANT_ROW_FIXTURE = {
  id: randomUUID(),
  name: 'Test Merchant',
  walletAddress: Keypair.random().publicKey(),
  network: 'testnet',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.clearAllMocks();
});

const MERCHANT_ROW = MERCHANT_ROW_FIXTURE;

const invoiceCounts = [
  { status: 'pending', n: 3n },
  { status: 'paid', n: 5n },
  { status: 'settled', n: 12n },
];

const txCountRow = [{ n: 12n }];

const recentSettlements = [
  {
    id: randomUUID(),
    invoiceId: randomUUID(),
    amountMinor: '5000000',
    stellarTxHash: 'a1b2c3',
    completedAt: new Date(),
    createdAt: new Date(),
  },
];

beforeEach(() => {
  mocks.reset();
});

describe('statsService.forMerchant', () => {
  it('returns merchant info + invoice counts + transactions + recent settlements', async () => {
    globalThis.fetch = vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes('/accounts/')) {
        return new Response(
          JSON.stringify({
            balances: [
              { asset_type: 'native', balance: '12.50' },
              {
                asset_type: 'credit_alphanum4',
                asset_code: 'USDC',
                asset_issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
                balance: '1240.00',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ) as Response;
      }
      return new Response('not found', { status: 404 }) as Response;
    });

    const stats = await statsService.forMerchant(MERCHANT_ROW.walletAddress);

    expect(stats.merchant.id).toBe(MERCHANT_ROW.id);
    expect(stats.wallet.accountExists).toBe(true);
    // The service stores all balances as minor-unit strings via Math.round(val * 100).
    expect(stats.wallet.xlmBalance).toBe('1250');
    expect(stats.wallet.usdcBalance).toBe('124000');
    expect(stats.wallet.usdcTrustline).toBe(true);
    expect(stats.invoices.pending).toBe(3);
    expect(stats.invoices.paid).toBe(5);
    expect(stats.invoices.settled).toBe(12);
    expect(stats.invoices.total).toBe(20);
    expect(stats.transactions).toBe(12);
    expect(stats.recentSettlements).toHaveLength(1);
    expect(stats.recentSettlements[0]?.stellarTxHash).toBe('a1b2c3');
  });

  it('handles unfunded wallets gracefully (no Horizon account)', async () => {
    globalThis.fetch = vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes('/accounts/')) {
        return new Response('not found', { status: 404 }) as Response;
      }
      return new Response('not found', { status: 404 }) as Response;
    });
    const stats = await statsService.forMerchant(MERCHANT_ROW.walletAddress);
    expect(stats.wallet.accountExists).toBe(false);
    expect(stats.wallet.xlmBalance).toBe('0');
    expect(stats.wallet.usdcBalance).toBe('0');
    expect(stats.wallet.usdcTrustline).toBe(false);
  });
});

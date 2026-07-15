// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock(import('@/server/config/env'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    env: {
      SESSION_SECRET: 'a'.repeat(32),
      INVOICE_DEFAULT_TTL_SECONDS: 900,
      INVOICE_AMOUNT_MINOR_MAX: 10_000_000_000,
      PAYMENT_AUTO_PAY_DELAY_MS: 10_000,
      SETTLEMENT_AFTER_PAY_DELAY_MS: 5_000,
      NODE_ENV: 'test',
      STELLAR_NETWORK: 'testnet',
    },
  };
});

type Chain = {
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  offset: ReturnType<typeof vi.fn>;
};

function makeChain(limitImpl: () => Promise<unknown[]>): Chain {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    orderBy: vi.fn(),
    offset: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.offset.mockReturnValue(chain);
  chain.limit.mockImplementation(limitImpl);
  return chain;
}

vi.mock('@/server/db/client', () => {
  return {
    db: {
      select: vi.fn(),
      insert: vi.fn(() => ({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'i-1' }]),
      })),
      update: vi.fn(() => ({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'i-1' }]),
      })),
    },
  };
});

vi.mock('@/server/service/merchant.service', () => ({
  merchantService: {
    ensureFromPublicKey: vi.fn().mockResolvedValue({ id: 'm-1' }),
  },
}));

import { invoiceService } from '@/server/service/invoice.service';

describe('invoiceService.create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-positive amounts', async () => {
    await expect(invoiceService.create('GABC', { amountMinor: '0' })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
    await expect(invoiceService.create('GABC', { amountMinor: '-1' })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
  });

  it('rejects amounts above the cap', async () => {
    await expect(
      invoiceService.create('GABC', { amountMinor: '99999999999999' }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects ttlSeconds out of range', async () => {
    await expect(
      invoiceService.create('GABC', { amountMinor: '100', ttlSeconds: 0 }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(
      invoiceService.create('GABC', { amountMinor: '100', ttlSeconds: 86_401 }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('returns a signedId, checkoutUrl and qrPayload on success', async () => {
    const { db } = await import('@/server/db/client');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(makeChain(() => Promise.resolve([])));
    const result = await invoiceService.create('GABC', { amountMinor: '20000000' });
    expect(result.signedId).toMatch(/\./);
    expect(result.checkoutUrl.startsWith('/checkout/')).toBe(true);
    expect(result.qrPayload.startsWith('/checkout/')).toBe(true);
  });
});

describe('invoiceService.getBySignedId', () => {
  it('404s on a malformed signed id', async () => {
    await expect(invoiceService.getBySignedId('garbage')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/config/env', () => ({
  env: { SESSION_SECRET: 'a'.repeat(32), NODE_ENV: 'test' },
}));

type SelectChain = {
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

function chainWith(limitImpl: () => Promise<unknown[]>): SelectChain {
  const c = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  } as unknown as SelectChain;
  (c.from as ReturnType<typeof vi.fn>).mockReturnValue(c);
  (c.where as ReturnType<typeof vi.fn>).mockReturnValue(c);
  (c.limit as ReturnType<typeof vi.fn>).mockImplementation(limitImpl);
  return c;
}

const selectQueue: SelectChain[] = [];

vi.mock('@/server/db/client', () => ({
  db: {
    select: vi.fn(() => {
      const next = selectQueue.shift();
      if (!next) throw new Error('No mocked select chain available');
      return next;
    }),
    insert: vi.fn(() => ({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'm-1' }]),
    })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'm-1', name: 'renamed' }]),
    })),
  },
}));

import { Keypair } from '@stellar/stellar-sdk';
import { beforeEach } from 'vitest';
import { merchantService } from '@/server/service/merchant.service';

describe('merchantService.ensureFromPublicKey', () => {
  beforeEach(() => {
    selectQueue.length = 0;
  });

  it('rejects an invalid public key', async () => {
    await expect(merchantService.ensureFromPublicKey('NOPE')).rejects.toMatchObject({
      code: 'INVALID_PUBLIC_KEY',
    });
  });

  it('returns the existing row when one is present', async () => {
    const valid = Keypair.random().publicKey();
    selectQueue.push(chainWith(() => Promise.resolve([{ id: 'm-1', walletAddress: valid }])));
    const row = await merchantService.ensureFromPublicKey(valid);
    expect(row.id).toBe('m-1');
  });

  it('inserts a new row when none exists', async () => {
    const valid = Keypair.random().publicKey();
    selectQueue.push(chainWith(() => Promise.resolve([])));
    const row = await merchantService.ensureFromPublicKey(valid, 'My Shop');
    expect(row.id).toBe('m-1');
  });
});

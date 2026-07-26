import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/config/stellar', () => ({
  stellar: {
    server: {
      loadAccount: vi.fn(),
    },
    horizonUrl: 'https://horizon-testnet.stellar.org',
    passphrase: 'Test SDF Network ; September 2015',
  },
}));

import { stellarService } from '@/server/service/stellar.service';

describe('stellarService.accountExists', () => {
  it('returns true when Horizon responds with the account', async () => {
    const { stellar } = await import('@/server/config/stellar');
    (stellar.server.loadAccount as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      accountId: 'GABC',
    });
    const exists = await stellarService.accountExists('GABC');
    expect(exists).toBe(true);
  });

  it('returns false when Horizon 404s', async () => {
    const { stellar } = await import('@/server/config/stellar');
    (stellar.server.loadAccount as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: { status: 404 },
    });
    const exists = await stellarService.accountExists('GABC');
    expect(exists).toBe(false);
  });
});

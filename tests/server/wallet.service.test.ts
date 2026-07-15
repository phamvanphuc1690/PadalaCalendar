// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/server/lib/http';

vi.mock('@/server/db/client', () => {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };
  return {
    db: {
      select: vi.fn(() => selectChain),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue([
              { id: 'w1', publicKey: 'GABC', label: 'main', network: 'testnet' },
            ]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'w1', label: 'updated' }]),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    },
  };
});

import { walletService } from '@/server/service/wallet.service';

describe('walletService', () => {
  it('rejects invalid public key with INVALID_PUBLIC_KEY', async () => {
    await expect(
      walletService.create({ publicKey: 'NOPE', label: 'l', network: 'testnet' }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      walletService.create({ publicKey: 'NOPE', label: 'l', network: 'testnet' }),
    ).rejects.toMatchObject({ code: 'INVALID_PUBLIC_KEY', status: 400 });
  });

  it('passes StrKey validation for a cryptographically valid ed25519 public key', async () => {
    const { Keypair } = await import('@stellar/stellar-sdk');
    const validPublicKey = Keypair.fromSecret(
      'SDR4C2CKNCVK4DWMTNI2IXFJ6BE3A6J3WVNCGR6Q3SCMJDTSVHMJGC6U',
    ).publicKey();
    await expect(
      walletService.create({ publicKey: validPublicKey, label: 'main', network: 'testnet' }),
    ).resolves.toMatchObject({ id: 'w1' });
  });
});

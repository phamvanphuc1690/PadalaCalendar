import { StrKey } from '@stellar/stellar-sdk';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { type Merchant, merchants, type NewMerchant } from '@/server/db/schema/merchants';
import { AppError } from '@/server/lib/http';

const SHAPE_RE_PUBLIC_KEY = /^G[A-Z2-7]{55}$/;

function shapeValid(key: string): boolean {
  return SHAPE_RE_PUBLIC_KEY.test(key);
}

export type EnsureInput = {
  publicKey: string;
  name?: string;
  network?: 'testnet' | 'public' | 'futurenet';
};

export const merchantService = {
  /**
   * Idempotently creates a `merchants` row keyed on the wallet address. The
   * first time an authenticated user calls any merchant endpoint, this
   * upserts a row so foreign-key relationships (invoices, withdrawals) work.
   */
  async ensureFromPublicKey(
    publicKey: string,
    opts: { name?: string; network?: string } = {},
  ): Promise<Merchant> {
    if (!shapeValid(publicKey) || !StrKey.isValidEd25519PublicKey(publicKey)) {
      throw new AppError('INVALID_PUBLIC_KEY', 'Stellar public key is invalid', 400);
    }
    const [existing] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.walletAddress, publicKey))
      .limit(1);
    if (existing) return existing;
    const insert: NewMerchant = {
      walletAddress: publicKey,
      name: opts.name ?? `Merchant ${publicKey.slice(0, 6)}…${publicKey.slice(-4)}`,
      network: (opts.network as NewMerchant['network']) ?? 'testnet',
    };
    const [row] = await db.insert(merchants).values(insert).returning();
    if (!row) {
      throw new AppError('INTERNAL', 'Failed to create merchant', 500);
    }
    return row;
  },

  async getById(id: string): Promise<Merchant> {
    const [row] = await db.select().from(merchants).where(eq(merchants.id, id)).limit(1);
    if (!row) throw new AppError('NOT_FOUND', 'Merchant not found', 404);
    return row;
  },

  async getByWallet(wallet: string): Promise<Merchant> {
    if (!shapeValid(wallet)) {
      throw new AppError('INVALID_PUBLIC_KEY', 'Stellar public key is invalid', 400);
    }
    const [row] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.walletAddress, wallet))
      .limit(1);
    if (!row) throw new AppError('NOT_FOUND', 'Merchant not found', 404);
    return row;
  },

  async rename(id: string, name: string): Promise<Merchant> {
    const [row] = await db
      .update(merchants)
      .set({ name, updatedAt: new Date() })
      .where(eq(merchants.id, id))
      .returning();
    if (!row) throw new AppError('NOT_FOUND', 'Merchant not found', 404);
    return row;
  },
};

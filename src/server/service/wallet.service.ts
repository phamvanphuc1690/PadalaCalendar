import { StrKey } from '@stellar/stellar-sdk';
import { and, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { type NewWallet, type Wallet, wallets } from '@/server/db/schema/wallets';
import { AppError } from '@/server/lib/http';

const SHAPE_RE_PUBLIC_KEY = /^G[A-Z2-7]{55}$/;

function shapeValid(key: string): boolean {
  return SHAPE_RE_PUBLIC_KEY.test(key);
}

export const walletService = {
  async list({
    ownerPublicKey,
    limit,
    offset,
  }: {
    ownerPublicKey: string;
    limit: number;
    offset: number;
  }): Promise<Wallet[]> {
    return db
      .select()
      .from(wallets)
      .where(eq(wallets.ownerPublicKey, ownerPublicKey))
      .limit(limit)
      .offset(offset);
  },

  async getById(id: string, ownerPublicKey: string): Promise<Wallet> {
    const [row] = await db
      .select()
      .from(wallets)
      .where(and(eq(wallets.id, id), eq(wallets.ownerPublicKey, ownerPublicKey)))
      .limit(1);
    if (!row) throw new AppError('NOT_FOUND', 'Wallet not found', 404);
    return row;
  },

  async create(input: NewWallet): Promise<Wallet> {
    if (!shapeValid(input.publicKey) || !StrKey.isValidEd25519PublicKey(input.publicKey)) {
      throw new AppError('INVALID_PUBLIC_KEY', 'Stellar public key is invalid', 400);
    }
    const [existing] = await db
      .select()
      .from(wallets)
      .where(
        and(
          eq(wallets.publicKey, input.publicKey),
          eq(wallets.ownerPublicKey, input.ownerPublicKey),
        ),
      )
      .limit(1);
    if (existing) throw new AppError('ALREADY_EXISTS', 'Wallet already exists', 409);
    const [row] = await db.insert(wallets).values(input).returning();
    return row;
  },

  async update(id: string, ownerPublicKey: string, patch: { label?: string }): Promise<Wallet> {
    const [row] = await db
      .update(wallets)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(wallets.id, id), eq(wallets.ownerPublicKey, ownerPublicKey)))
      .returning();
    if (!row) throw new AppError('NOT_FOUND', 'Wallet not found', 404);
    return row;
  },

  async remove(id: string, ownerPublicKey: string): Promise<void> {
    await db
      .delete(wallets)
      .where(and(eq(wallets.id, id), eq(wallets.ownerPublicKey, ownerPublicKey)));
  },
};

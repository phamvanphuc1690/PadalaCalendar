import { and, desc, eq, lt } from 'drizzle-orm';
import { env } from '@/server/config/env';
import { db } from '@/server/db/client';
import {
  type NewWithdrawal,
  type PayoutMeta,
  type Withdrawal,
  withdrawals,
} from '@/server/db/schema/withdrawals';
import { isMinorString } from '@/server/lib/bigint';
import { AppError } from '@/server/lib/http';
import { merchantService } from './merchant.service';
import { transitionWithdrawal } from './stateTransitions.service';

const LIST_LIMIT_CAP = 200;
const LIST_DEFAULT_LIMIT = 20;

export type CreateWithdrawalInput = {
  quoteId: string;
  payoutMethod: 'bank_deposit' | 'cash_pickup';
  payoutMeta: PayoutMeta;
  ttlSeconds?: number;
};

export const withdrawalService = {
  async create(publicKey: string, input: CreateWithdrawalInput): Promise<Withdrawal> {
    const merchant = await merchantService.ensureFromPublicKey(publicKey);

    const { quotes } = await import('@/server/db/schema/quotes');
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, input.quoteId)).limit(1);
    if (!quote) throw new AppError('NOT_FOUND', 'Quote not found', 404);
    if (quote.merchantId !== merchant.id) {
      throw new AppError('FORBIDDEN', 'Quote does not belong to merchant', 403);
    }
    if (quote.expiresAt.getTime() < Date.now()) {
      throw new AppError('INVALID_INPUT', 'Quote has expired', 409);
    }
    if (!isMinorString(quote.sellAmount)) {
      throw new AppError('INVALID_INPUT', 'Corrupt quote amount', 400);
    }

    const ttl = input.ttlSeconds ?? env.WITHDRAWAL_DEFAULT_TTL_SECONDS;
    if (ttl <= 0 || ttl > 86_400) {
      throw new AppError('INVALID_INPUT', 'ttlSeconds must be between 1 and 86400', 400);
    }
    const expiresAt = new Date(Date.now() + ttl * 1000);

    const insert: NewWithdrawal = {
      merchantId: merchant.id,
      quoteId: quote.id,
      anchorDomain: quote.anchorDomain,
      sourceAmountMinor: quote.sellAmount,
      destinationAsset: quote.buyAsset,
      destinationAmount: quote.buyAmount,
      payoutMethod: input.payoutMethod,
      payoutMeta: input.payoutMeta,
      status: 'quoted',
      expiresAt,
    };
    const [row] = await db.insert(withdrawals).values(insert).returning();
    if (!row) throw new AppError('INTERNAL', 'Failed to create withdrawal', 500);
    return row;
  },

  async get(id: string): Promise<Withdrawal> {
    const [row] = await db.select().from(withdrawals).where(eq(withdrawals.id, id)).limit(1);
    if (!row) throw new AppError('NOT_FOUND', 'Withdrawal not found', 404);
    return row;
  },

  async getForMerchant(merchantId: string, id: string): Promise<Withdrawal> {
    const [row] = await db
      .select()
      .from(withdrawals)
      .where(and(eq(withdrawals.id, id), eq(withdrawals.merchantId, merchantId)))
      .limit(1);
    if (!row) throw new AppError('NOT_FOUND', 'Withdrawal not found', 404);
    return row;
  },

  async listForMerchant(
    merchantId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<{ items: Withdrawal[]; limit: number; offset: number }> {
    const limit = Math.min(Math.max(opts.limit ?? LIST_DEFAULT_LIMIT, 1), LIST_LIMIT_CAP);
    const offset = Math.max(opts.offset ?? 0, 0);
    const items = await db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.merchantId, merchantId))
      .orderBy(desc(withdrawals.createdAt))
      .limit(limit)
      .offset(offset);
    return { items, limit, offset };
  },

  async markSubmitted(
    id: string,
    opts: {
      anchorTxId: string;
      anchorAccount: string;
      memo: string;
      memoType: 'text' | 'id' | 'hash' | 'return';
    },
  ): Promise<Withdrawal> {
    const [existing] = await db
      .update(withdrawals)
      .set({ anchorTxId: opts.anchorTxId })
      .where(eq(withdrawals.id, id))
      .returning();
    if (!existing) throw new AppError('NOT_FOUND', 'Withdrawal not found', 404);
    return transitionWithdrawal(id, 'submitted', {
      actor: 'anchor',
      reason: 'anchor_started',
      meta: { anchorTxId: opts.anchorTxId },
      anchorAccount: opts.anchorAccount,
      memo: opts.memo,
      memoType: opts.memoType,
    });
  },

  async markProcessing(id: string, opts: { stellarTxHash?: string } = {}): Promise<Withdrawal> {
    return transitionWithdrawal(id, 'processing', {
      actor: 'system',
      reason: 'stellar_payment_sent',
      meta: opts,
    });
  },

  async markCompleted(id: string, opts: { anchorTxId?: string } = {}): Promise<Withdrawal> {
    return transitionWithdrawal(id, 'completed', {
      actor: 'anchor',
      reason: 'anchor_completed',
      meta: opts,
    });
  },

  async markRefunded(id: string, opts: { reason?: string } = {}): Promise<Withdrawal> {
    return transitionWithdrawal(id, 'refunded', {
      actor: 'anchor',
      reason: opts.reason ?? 'anchor_refunded',
    });
  },

  async markFailed(id: string, opts: { reason: string }): Promise<Withdrawal> {
    return transitionWithdrawal(id, 'failed', {
      actor: 'system',
      reason: opts.reason,
    });
  },

  async markExpired(id: string): Promise<Withdrawal> {
    return transitionWithdrawal(id, 'expired', { actor: 'system', reason: 'expired' });
  },

  async recordStellarTxHash(id: string, stellarTxHash: string): Promise<Withdrawal> {
    const [row] = await db
      .update(withdrawals)
      .set({ stellarTxHash, updatedAt: new Date() })
      .where(eq(withdrawals.id, id))
      .returning();
    if (!row) throw new AppError('NOT_FOUND', 'Withdrawal not found', 404);
    return row;
  },

  /** Bulk-expire quoted/submitted withdrawals past their expiry. */
  async expireStale(now: Date = new Date()): Promise<number> {
    const stale = await db
      .select({ id: withdrawals.id, version: withdrawals.version, status: withdrawals.status })
      .from(withdrawals)
      .where(and(lt(withdrawals.expiresAt, now)))
      .limit(100);
    let count = 0;
    for (const row of stale) {
      if (row.status !== 'quoted' && row.status !== 'submitted') continue;
      try {
        await transitionWithdrawal(row.id, 'expired', {
          actor: 'system',
          reason: 'expired',
          expectedVersion: row.version,
        });
        count += 1;
      } catch {
        // raced
      }
    }
    return count;
  },
};

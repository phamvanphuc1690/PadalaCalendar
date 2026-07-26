import { eq } from 'drizzle-orm';
import { getSep10Jwt } from '@/server/anchor/sep10';
import {
  getTransaction,
  type Sep24StartResponse,
  type Sep24Transaction,
  startInteractiveWithdrawal,
} from '@/server/anchor/sep24';
import { postQuote, type Sep38Quote } from '@/server/anchor/sep38';
import { env } from '@/server/config/env';
import { db } from '@/server/db/client';
import { type Quote, quotes } from '@/server/db/schema/quotes';
import type { PayoutMeta } from '@/server/db/schema/withdrawals';
import { isMinorString } from '@/server/lib/bigint';
import { AppError } from '@/server/lib/http';
import { anchorService } from './anchor.service';
import { merchantService } from './merchant.service';
import { paymentDetectionService } from './paymentDetection.service';
import { withdrawalService } from './withdrawal.service';

/**
 * Off-ramp glue. The service layer sits on top of SEP-38 (RFQ) and SEP-24
 * (withdrawal). It owns:
 *   - Requesting firm quotes from the anchor.
 *   - Starting interactive withdrawal flows.
 *   - Polling the anchor for status updates.
 *   - Coordinating with `paymentDetectionService` for the merchant's outbound
 *     USDC transfer to the anchor.
 */

export type CreateQuoteInput = {
  sellAsset: string;
  buyAsset: string;
  sellAmount: string;
  buyDeliveryMethod: string;
  countryCode?: string;
  context?: 'sep6' | 'sep24' | 'sep31';
  sellDeliveryMethod?: string;
};

export type StartWithdrawalInput = {
  withdrawalId: string;
};

export const offrampService = {
  async createQuote(publicKey: string, input: CreateQuoteInput): Promise<Quote> {
    if (!isMinorString(input.sellAmount)) {
      throw new AppError('INVALID_INPUT', 'sellAmount must be a non-negative integer string', 400);
    }
    if (input.buyDeliveryMethod !== 'bank_deposit' && input.buyDeliveryMethod !== 'cash_pickup') {
      throw new AppError(
        'INVALID_INPUT',
        'buyDeliveryMethod must be bank_deposit or cash_pickup',
        400,
      );
    }
    const merchant = await merchantService.ensureFromPublicKey(publicKey);
    const { sep38, webAuth } = await anchorService.resolveEndpoints(env.OFFRAMP_ANCHOR_DOMAIN);
    const jwt = await getSep10Jwt(
      env.OFFRAMP_ANCHOR_DOMAIN,
      merchant.walletAddress,
      webAuth ?? undefined,
    );
    const quote: Sep38Quote = await postQuote(sep38, jwt, {
      sell_asset: input.sellAsset,
      buy_asset: input.buyAsset,
      sell_amount: input.sellAmount,
      buy_delivery_method: input.buyDeliveryMethod,
      country_code: input.countryCode,
      context: input.context ?? 'sep24',
      sell_delivery_method: input.sellDeliveryMethod,
    });
    const expiresAt = new Date(quote.expires_at);
    const [row] = await db
      .insert(quotes)
      .values({
        merchantId: merchant.id,
        anchorDomain: env.OFFRAMP_ANCHOR_DOMAIN,
        anchorQuoteId: quote.id,
        sellAsset: quote.sell_asset,
        buyAsset: quote.buy_asset,
        sellAmount: quote.sell_amount,
        buyAmount: quote.buy_amount,
        totalPrice: quote.total_price,
        price: quote.price,
        feeTotal: quote.fee.total,
        feeAsset: quote.fee.asset,
        buyDeliveryMethod: quote.buy_delivery_method,
        sellDeliveryMethod: quote.sell_delivery_method,
        countryCode: input.countryCode,
        context: input.context ?? 'sep24',
        rawResponse: quote,
        expiresAt,
      })
      .returning();
    if (!row) throw new AppError('INTERNAL', 'Failed to persist quote', 500);
    return row;
  },

  async getQuote(id: string, publicKey: string): Promise<Quote> {
    const merchant = await merchantService.ensureFromPublicKey(publicKey);
    const [row] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
    if (!row) throw new AppError('NOT_FOUND', 'Quote not found', 404);
    if (row.merchantId !== merchant.id) {
      throw new AppError('FORBIDDEN', 'Quote does not belong to merchant', 403);
    }
    return row;
  },

  /**
   * Start the interactive withdrawal flow at the anchor. The anchor returns
   * a `id` and a `url` (the webapp the merchant must complete KYC with).
   * For the MVP, we treat the start as the anchor's "submitted" state and
   * immediately call the anchor to retrieve `withdraw_anchor_account` and
   * `withdraw_memo` if they are already available.
   */
  async startWithdrawal(
    publicKey: string,
    input: StartWithdrawalInput,
  ): Promise<{ start: Sep24StartResponse }> {
    const merchant = await merchantService.ensureFromPublicKey(publicKey);
    const withdrawal = await withdrawalService.getForMerchant(merchant.id, input.withdrawalId);
    if (withdrawal.status !== 'quoted') {
      throw new AppError('INVALID_INPUT', `Withdrawal already ${withdrawal.status}`, 409);
    }
    const { sep24, webAuth } = await anchorService.resolveEndpoints(withdrawal.anchorDomain);
    const jwt = await getSep10Jwt(
      withdrawal.anchorDomain,
      merchant.walletAddress,
      webAuth ?? undefined,
    );
    const start = await startInteractiveWithdrawal(sep24, jwt, {
      account: merchant.walletAddress,
      asset_code: 'USDC',
      amount: withdrawal.sourceAmountMinor,
      quote_id:
        (
          await db
            .select()
            .from(quotes)
            .where(eq(quotes.id, withdrawal.quoteId ?? ''))
            .limit(1)
        )[0]?.anchorQuoteId ?? undefined,
      country_code:
        (
          await db
            .select()
            .from(quotes)
            .where(eq(quotes.id, withdrawal.quoteId ?? ''))
            .limit(1)
        )[0]?.countryCode ?? undefined,
    });
    if (start.type === 'authentication_required') {
      throw new AppError('UNAUTHORIZED', 'Anchor requires re-authentication', 401);
    }
    if (start.type === 'expired') {
      throw new AppError('INVALID_INPUT', 'Anchor rejected withdrawal as expired', 410);
    }
    if (start.type === 'interactive_customer_info_needed') {
      // Persist anchorTxId immediately. The merchant's checkout webapp will
      // complete KYC and signal when the user is ready to transfer.
      await db
        .update((await import('@/server/db/schema/withdrawals')).withdrawals)
        .set({ anchorTxId: start.id, updatedAt: new Date() })
        .where(eq((await import('@/server/db/schema/withdrawals')).withdrawals.id, withdrawal.id));
      return { start };
    }
    return { start };
  },

  /**
   * Poll the anchor for the current status of a withdrawal. Used by the
   * bootstrap poller and the anchor callback handler.
   */
  async pollStatus(publicKey: string, withdrawalId: string): Promise<Sep24Transaction> {
    const merchant = await merchantService.ensureFromPublicKey(publicKey);
    const withdrawal = await withdrawalService.getForMerchant(merchant.id, withdrawalId);
    if (!withdrawal.anchorTxId) {
      throw new AppError('INVALID_INPUT', 'Withdrawal has no anchor transaction id', 409);
    }
    const { sep24, webAuth } = await anchorService.resolveEndpoints(withdrawal.anchorDomain);
    const jwt = await getSep10Jwt(
      withdrawal.anchorDomain,
      merchant.walletAddress,
      webAuth ?? undefined,
    );
    const tx = await getTransaction(sep24, jwt, withdrawal.anchorTxId);
    await this.applyStatus(withdrawal.id, tx);
    return tx;
  },

  async applyStatus(withdrawalId: string, tx: Sep24Transaction): Promise<void> {
    if (tx.status === 'pending_user_transfer_start') {
      await withdrawalService.markSubmitted(withdrawalId, {
        anchorTxId: tx.id,
        anchorAccount: tx.withdraw_anchor_account ?? '',
        memo: tx.withdraw_memo ?? '',
        memoType: (tx.withdraw_memo_type as 'text' | 'id' | 'hash' | 'return') ?? 'text',
      });
    } else if (
      tx.status === 'pending_external' ||
      tx.status === 'pending_anchor' ||
      tx.status === 'pending_stellar'
    ) {
      await withdrawalService.markProcessing(withdrawalId);
    } else if (tx.status === 'completed') {
      await withdrawalService.markCompleted(withdrawalId, { anchorTxId: tx.id });
    } else if (tx.status === 'refunded') {
      await withdrawalService.markRefunded(withdrawalId, {
        reason: tx.status_eta ? 'anchor_refunded' : 'refunded',
      });
    } else if (
      tx.status === 'error' ||
      tx.status === 'no_market' ||
      tx.status === 'too_small' ||
      tx.status === 'too_large'
    ) {
      await withdrawalService.markFailed(withdrawalId, { reason: tx.status });
    }
  },

  /**
   * Start a watcher for the merchant's destination wallet if not already
   * running, so the hub can detect the merchant's outbound USDC transfer to
   * the anchor.
   */
  async watchMerchantForOutbound(publicKey: string): Promise<void> {
    paymentDetectionService.watchInvoice(publicKey);
  },
};

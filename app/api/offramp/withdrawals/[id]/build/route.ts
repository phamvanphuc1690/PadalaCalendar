import type { NextRequest } from 'next/server';
import { getSep10Jwt } from '@/server/anchor/sep10';
import { getTransaction } from '@/server/anchor/sep24';
import { AppError, ok } from '@/server/lib/http';
import { compose } from '@/server/middleware/compose';
import type { HandlerContext } from '@/server/middleware/compose';
import { withAuth } from '@/server/middleware/withAuth';
import { withError } from '@/server/middleware/withError';
import { withRateLimit } from '@/server/middleware/withRateLimit';
import { anchorService } from '@/server/service/anchor.service';
import { merchantService } from '@/server/service/merchant.service';
import { withdrawalService } from '@/server/service/withdrawal.service';
import { usdcAsset } from '@/server/stellar/network';
import { buildPaymentXdr } from '@/server/stellar/xdr';

const POLL_RETRIES = 10;
const POLL_INTERVAL_MS = 600;

async function handler(_req: NextRequest, ctx: HandlerContext) {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Missing session', 401);
  const { id } = await (ctx.params as Promise<{ id: string }>);
  const merchant = await merchantService.ensureFromPublicKey(ctx.publicKey);
  let withdrawal = await withdrawalService.getForMerchant(merchant.id, id);

  if (!withdrawal.anchorTxId) {
    throw new AppError('INVALID_INPUT', 'Withdrawal not started — call PATCH /withdrawals first', 409);
  }

  // Poll anchor until pending_user_transfer_start (anchor is ready to receive funds).
  if (!withdrawal.withdrawAnchorAccount) {
    const { sep24, webAuth } = await anchorService.resolveEndpoints(withdrawal.anchorDomain);
    const jwt = await getSep10Jwt(
      withdrawal.anchorDomain,
      merchant.walletAddress,
      webAuth ?? undefined,
    );
    let anchorTx = await getTransaction(sep24, jwt, withdrawal.anchorTxId);
    let attempts = 0;
    while (anchorTx.status !== 'pending_user_transfer_start' && attempts < POLL_RETRIES) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      anchorTx = await getTransaction(sep24, jwt, withdrawal.anchorTxId);
      attempts += 1;
    }
    if (anchorTx.status !== 'pending_user_transfer_start') {
      throw new AppError(
        'INVALID_INPUT',
        `Anchor not ready (status: ${anchorTx.status}). Try again shortly.`,
        409,
      );
    }
    // Persist anchor account + memo and transition quoted → submitted.
    await withdrawalService.markSubmitted(id, {
      anchorTxId: anchorTx.id,
      anchorAccount: anchorTx.withdraw_anchor_account ?? '',
      memo: anchorTx.withdraw_memo ?? '',
      memoType: (anchorTx.withdraw_memo_type as 'text' | 'id' | 'hash' | 'return') ?? 'text',
    });
    withdrawal = await withdrawalService.getForMerchant(merchant.id, id);
  }

  if (!withdrawal.withdrawAnchorAccount) {
    throw new AppError('INTERNAL', 'Anchor account still not available after polling', 500);
  }

  // Amount: sourceAmountMinor is in cents (e.g. "1000" = 10 USDC). Stellar needs major.
  const amountMajor = (Number(withdrawal.sourceAmountMinor) / 100).toFixed(7);

  const xdr = await buildPaymentXdr({
    sourcePublicKey: merchant.walletAddress,
    destinationPublicKey: withdrawal.withdrawAnchorAccount,
    asset: usdcAsset(),
    amount: amountMajor,
    memo: withdrawal.withdrawMemo
      ? {
          type: (withdrawal.withdrawMemoType ?? 'text') as 'text' | 'id' | 'hash' | 'return',
          value: withdrawal.withdrawMemo,
        }
      : undefined,
  });

  return ok({ xdr });
}

export const GET = compose(withError, withAuth, withRateLimit)(handler);

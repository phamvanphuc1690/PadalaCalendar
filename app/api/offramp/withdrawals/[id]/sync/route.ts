import { getSep10Jwt } from '@/server/anchor/sep10';
import { getTransaction } from '@/server/anchor/sep24';
import { AppError, ok } from '@/server/lib/http';
import { compose } from '@/server/middleware/compose';
import { withAuth } from '@/server/middleware/withAuth';
import { withError } from '@/server/middleware/withError';
import { withRateLimit } from '@/server/middleware/withRateLimit';
import type { HandlerContext } from '@/server/middleware/compose';
import { anchorService } from '@/server/service/anchor.service';
import { merchantService } from '@/server/service/merchant.service';
import { offrampService } from '@/server/service/offramp.service';
import { withdrawalService } from '@/server/service/withdrawal.service';
import type { NextRequest } from 'next/server';

const TERMINAL = new Set(['completed', 'refunded', 'expired', 'failed']);

async function handler(req: NextRequest, ctx: HandlerContext) {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Missing session', 401);
  const { id } = await (ctx.params as Promise<{ id: string }>);
  const merchant = await merchantService.ensureFromPublicKey(ctx.publicKey);
  const withdrawal = await withdrawalService.getForMerchant(merchant.id, id);

  if (TERMINAL.has(withdrawal.status) || !withdrawal.anchorTxId) {
    return ok(withdrawal);
  }

  const { sep24, webAuth } = await anchorService.resolveEndpoints(withdrawal.anchorDomain);
  const jwt = await getSep10Jwt(
    withdrawal.anchorDomain,
    merchant.walletAddress,
    webAuth ?? undefined,
  );
  const anchorTx = await getTransaction(sep24, jwt, withdrawal.anchorTxId);
  await offrampService.applyStatus(id, anchorTx);

  const updated = await withdrawalService.getForMerchant(merchant.id, id);
  return ok(updated);
}

export const POST = compose(withError, withAuth, withRateLimit)(handler);

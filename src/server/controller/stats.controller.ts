import type { NextRequest } from 'next/server';
import { AppError, ok } from '@/server/lib/http';
import type { HandlerContext } from '@/server/middleware/compose';
import { statsService } from '@/server/service/stats.service';

export async function getMerchantStats(req: NextRequest, ctx: HandlerContext) {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Missing session', 401);
  const stats = await statsService.forMerchant(ctx.publicKey);
  return ok(stats);
}

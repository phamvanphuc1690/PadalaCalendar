import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError, ok } from '@/server/lib/http';
import type { HandlerContext } from '@/server/middleware/compose';
import { merchantService } from '@/server/service/merchant.service';

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
});

export async function getMerchant(req: NextRequest, ctx: HandlerContext) {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Missing session', 401);
  const merchant = await merchantService.ensureFromPublicKey(ctx.publicKey);
  return ok({
    id: merchant.id,
    name: merchant.name,
    walletAddress: merchant.walletAddress,
    network: merchant.network,
    createdAt: merchant.createdAt,
  });
}

export async function updateMerchant(req: NextRequest, ctx: HandlerContext) {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Missing session', 401);
  const body = updateSchema.parse(await req.json().catch(() => ({})));
  if (Object.keys(body).length === 0) {
    throw new AppError('INVALID_INPUT', 'No fields to update', 400);
  }
  const merchant = await merchantService.ensureFromPublicKey(ctx.publicKey);
  const next = body.name ? await merchantService.rename(merchant.id, body.name) : merchant;
  return ok(next);
}

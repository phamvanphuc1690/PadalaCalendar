import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError, created, ok } from '@/server/lib/http';
import type { HandlerContext } from '@/server/middleware/compose';
import { sendService } from '@/server/service/send.service';

const buildSchema = z.object({
  destination: z.string().min(1).max(280),
  amount: z.string().regex(/^[0-9]+$/),
  memo: z
    .object({
      type: z.enum(['text', 'id', 'hash']),
      value: z.string().min(1).max(64),
    })
    .optional(),
  timeoutSec: z.coerce.number().int().positive().max(360).optional(),
});

const submitSchema = z.object({
  signedXdr: z.string().min(1),
});

export async function buildPayment(req: NextRequest, ctx: HandlerContext) {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Missing session', 401);
  const body = buildSchema.parse(await req.json());
  const result = await sendService.build(ctx.publicKey, body);
  return ok(result);
}

export async function submitPayment(req: NextRequest, ctx: HandlerContext) {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Missing session', 401);
  const body = submitSchema.parse(await req.json());
  const result = await sendService.submit(ctx.publicKey, body.signedXdr);
  return created(result);
}

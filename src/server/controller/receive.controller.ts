import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError, ok } from '@/server/lib/http';
import type { HandlerContext } from '@/server/middleware/compose';
import { receiveService } from '@/server/service/receive.service';

const buildSchema = z.object({
  amount: z.string().regex(/^[0-9]+$/),
  memo: z
    .object({
      type: z.enum(['text', 'id', 'hash']),
      value: z.string().min(1).max(64),
    })
    .optional(),
  origin: z.string().url().optional(),
  msg: z.string().max(120).optional(),
});

export async function build(req: NextRequest, ctx: HandlerContext) {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Missing session', 401);
  const body = buildSchema.parse(await req.json());
  const result = receiveService.build(ctx.publicKey, body);
  return ok(result);
}

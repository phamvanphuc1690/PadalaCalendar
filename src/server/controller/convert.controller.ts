import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError, created, ok } from '@/server/lib/http';
import type { HandlerContext } from '@/server/middleware/compose';
import { type ConvertQuote, convertService } from '@/server/service/convert.service';

const quoteSchema = z.object({
  destinationAssetCode: z.string().min(1).max(12),
  destinationAssetIssuer: z.string().min(56).max(56).nullable(),
  amount: z.string().regex(/^[0-9]+$/),
  slippageBps: z.coerce.number().int().min(0).max(1000).optional(),
});

const buildSchema = z.object({
  quote: z.unknown(),
});

const submitSchema = z.object({
  signedXdr: z.string().min(1),
});

export async function quote(req: NextRequest, ctx: HandlerContext) {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Missing session', 401);
  const url = new URL(req.url);
  const params = quoteSchema.parse({
    destinationAssetCode: url.searchParams.get('destinationAssetCode') ?? undefined,
    destinationAssetIssuer: url.searchParams.get('destinationAssetIssuer') ?? null,
    amount: url.searchParams.get('amount') ?? undefined,
    slippageBps: url.searchParams.get('slippageBps') ?? undefined,
  });
  const quoteResult = await convertService.quote(ctx.publicKey, params);
  return ok(quoteResult);
}

export async function build(req: NextRequest, ctx: HandlerContext) {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Missing session', 401);
  const body = buildSchema.parse(await req.json());
  // The client posts the quote back unchanged after a user confirmation
  // step. We re-validate the shape to catch tampering.
  const quote = body.quote as ConvertQuote;
  if (!quote || typeof quote !== 'object' || !quote.sourceAmount || !quote.destinationAmount) {
    throw new AppError('INVALID_INPUT', 'Invalid quote', 400);
  }
  const result = await convertService.build(ctx.publicKey, quote);
  return ok(result);
}

export async function submit(req: NextRequest, ctx: HandlerContext) {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Missing session', 401);
  const body = submitSchema.parse(await req.json());
  const result = await convertService.submit(ctx.publicKey, body.signedXdr);
  return created(result);
}

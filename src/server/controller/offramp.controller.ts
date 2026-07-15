import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { assertCallbackSignature } from '@/server/anchor/callback';
import { env } from '@/server/config/env';
import { AppError, created, ok } from '@/server/lib/http';
import { createSseResponse } from '@/server/lib/sseStream';
import type { HandlerContext } from '@/server/middleware/compose';
import { anchorService } from '@/server/service/anchor.service';
import { merchantService } from '@/server/service/merchant.service';
import { notificationService } from '@/server/service/notification.service';
import { offrampService } from '@/server/service/offramp.service';
import { withdrawalService } from '@/server/service/withdrawal.service';

const assetRefOrString = z.union([
  z.string().min(1).max(120),
  z.object({ code: z.string().min(1).max(120), issuer: z.string().nullable().optional() })
    .transform(({ code }) => code),
]);

const createQuoteSchema = z.object({
  sellAsset: assetRefOrString,
  buyAsset: assetRefOrString,
  sellAmount: z.string().regex(/^[0-9]+$/),
  buyDeliveryMethod: z.enum(['bank_deposit', 'cash_pickup']),
  countryCode: z.string().length(2).optional(),
  context: z.enum(['sep6', 'sep24', 'sep31']).optional(),
  sellDeliveryMethod: z.string().optional(),
});

const createWithdrawalSchema = z.object({
  quoteId: z.string().uuid(),
  payoutMethod: z.enum(['bank_deposit', 'cash_pickup']),
  payoutMeta: z.union([
    z.object({
      v: z.literal(1),
      kind: z.literal('bank_deposit'),
      data: z.object({
        bankName: z.string().min(1).max(120),
        accountNumber: z.string().min(1).max(64),
        accountName: z.string().min(1).max(120),
      }),
    }),
    z.object({
      v: z.literal(1),
      kind: z.literal('cash_pickup'),
      data: z.object({
        pickupLocation: z.string().min(1).max(120),
        recipientName: z.string().min(1).max(120),
        recipientId: z.string().max(64).optional(),
      }),
    }),
  ]),
  ttlSeconds: z.coerce.number().int().positive().max(86_400).optional(),
});

const startWithdrawalSchema = z.object({
  withdrawalId: z.string().uuid(),
});

const submitSignedSchema = z.object({
  signedXdr: z.string().min(1),
});

export async function createQuote(req: NextRequest, ctx: HandlerContext) {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Missing session', 401);
  const body = createQuoteSchema.parse(await req.json());
  const quote = await offrampService.createQuote(ctx.publicKey, body);
  return created(quote);
}

export async function getQuote(req: NextRequest, ctx: HandlerContext) {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Missing session', 401);
  const { id } = await (ctx.params as Promise<{ id: string }>);
  const quote = await offrampService.getQuote(id, ctx.publicKey);
  return ok(quote);
}

export async function createWithdrawal(req: NextRequest, ctx: HandlerContext) {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Missing session', 401);
  const body = createWithdrawalSchema.parse(await req.json());
  const withdrawal = await withdrawalService.create(ctx.publicKey, body);
  return created(withdrawal);
}

export async function listWithdrawals(req: NextRequest, ctx: HandlerContext) {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Missing session', 401);
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 200);
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0);
  const merchant = await merchantService.ensureFromPublicKey(ctx.publicKey);
  const { items } = await withdrawalService.listForMerchant(merchant.id, { limit, offset });
  return ok({ items, limit, offset });
}

export async function getWithdrawal(req: NextRequest, ctx: HandlerContext) {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Missing session', 401);
  const { id } = await (ctx.params as Promise<{ id: string }>);
  const merchant = await merchantService.ensureFromPublicKey(ctx.publicKey);
  const withdrawal = await withdrawalService.getForMerchant(merchant.id, id);
  return ok(withdrawal);
}

export async function startWithdrawal(req: NextRequest, ctx: HandlerContext) {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Missing session', 401);
  const body = startWithdrawalSchema.parse(await req.json());
  const result = await offrampService.startWithdrawal(ctx.publicKey, body);
  return ok(result);
}

export async function submitSignedWithdrawal(req: NextRequest, ctx: HandlerContext) {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Missing session', 401);
  const { id } = await (ctx.params as Promise<{ id: string }>);
  const body = submitSignedSchema.parse(await req.json());
  const merchant = await merchantService.ensureFromPublicKey(ctx.publicKey);
  const withdrawal = await withdrawalService.getForMerchant(merchant.id, id);
  if (!withdrawal.withdrawAnchorAccount || !withdrawal.withdrawMemo) {
    throw new AppError('INVALID_INPUT', 'Withdrawal not yet submitted to anchor', 409);
  }
  // Submit and persist the tx hash.
  const { submitTransaction } = await import('@/server/stellar/xdr');
  const { hash } = await submitTransaction(body.signedXdr);
  const updated = await withdrawalService.recordStellarTxHash(id, hash);
  await offrampService.watchMerchantForOutbound(ctx.publicKey);
  return ok(updated);
}

export function streamWithdrawal(_req: NextRequest, _ctx: HandlerContext) {
  return createSseResponse(async (emit, signal) => {
    if (!_ctx.publicKey) {
      emit('error', { code: 'UNAUTHORIZED', message: 'Missing session' });
      return;
    }
    const { id } = await (_ctx.params as Promise<{ id: string }>);
    const merchant = await merchantService.ensureFromPublicKey(_ctx.publicKey);
    const current = await notificationService.getCurrentWithdrawal(id);
    if (!current || current.merchantId !== merchant.id) {
      emit('error', { code: 'NOT_FOUND', message: 'Withdrawal not found' });
      return;
    }
    emit('withdrawal.updated', {
      withdrawalId: current.id,
      version: current.version,
      status: current.status,
      completedAt: current.completedAt,
      occurredAt: new Date(),
    });
    notificationService.subscribeWithdrawal(id, (evt) => emit('withdrawal.updated', evt), signal);
  });
}

/**
 * Anchor callback endpoint. Public (verified by the anchor's signing key
 * per SEP-10/12/24). The anchor POSTs status updates here.
 */
export async function anchorCallback(req: NextRequest, _ctx: HandlerContext) {
  const { id } = await (_ctx.params as Promise<{ id: string }>);
  const rawBody = await req.text();
  const signatureHeader = req.headers.get('Signature');
  // Look up the anchor to find the signing key.
  const withdrawal = await withdrawalService.get(id);
  let signingKey: string | null = null;
  try {
    const anchor = await anchorService.getOrFetch(withdrawal.anchorDomain);
    signingKey = anchor.signingKey;
  } catch {
    /* fall through */
  }
  if (!signingKey) {
    throw new AppError('UNAUTHORIZED', 'No signing key for anchor', 401);
  }
  assertCallbackSignature({
    signatureHeader,
    rawBody,
    host: new URL(
      env.OFFRAMP_ANCHOR_DOMAIN.startsWith('http')
        ? env.OFFRAMP_ANCHOR_DOMAIN
        : `https://${env.OFFRAMP_ANCHOR_DOMAIN}`,
    ).host,
    signingKey,
  });
  const body = JSON.parse(rawBody) as { status: string };
  const tx = {
    id,
    status: body.status as Parameters<typeof offrampService.applyStatus>[1]['status'],
  };
  await offrampService.applyStatus(id, tx as Parameters<typeof offrampService.applyStatus>[1]);
  return ok({ ok: true });
}

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { env } from '@/server/config/env';
import { publicEnv } from '@/server/config/env.public';
import { AppError, created, ok } from '@/server/lib/http';
import { logger } from '@/server/lib/logger';
import { createSseResponse } from '@/server/lib/sseStream';
import type { HandlerContext } from '@/server/middleware/compose';
import type { PaymentIntent } from '@/server/db/schema/paymentIntents';
import { invoiceService } from '@/server/service/invoice.service';
import { merchantService } from '@/server/service/merchant.service';
import { notificationService } from '@/server/service/notification.service';
import { paymentDetectionService } from '@/server/service/paymentDetection.service';
import { settlementService } from '@/server/service/settlement.service';

const createSchema = z.object({
  amountMinor: z.string().regex(/^[0-9]+$/, 'amountMinor must be a non-negative integer string'),
  currency: z.string().min(1).max(8).optional(),
  description: z.string().max(280).optional(),
  ttlSeconds: z.coerce.number().int().positive().max(86_400).optional(),
});

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function createInvoice(req: NextRequest, ctx: HandlerContext) {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Missing session', 401);
  const body = createSchema.parse(await req.json());
  const result = await invoiceService.create(ctx.publicKey, body);
  // Start a payment watcher for this merchant's wallet so the new invoice
  // gets detected as soon as a payment lands.
  paymentDetectionService.watchInvoice(result.invoice.destinationAddress);
  const base = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  return created({
    invoice: result.invoice,
    signedId: result.signedId,
    checkoutUrl: `${base}${result.checkoutUrl}`,
    qrPayload: `${base}${result.qrPayload}`,
  });
}

export async function listInvoices(req: NextRequest, ctx: HandlerContext) {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Missing session', 401);
  const url = new URL(req.url);
  const params = listSchema.parse({
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
  const merchant = await merchantService.ensureFromPublicKey(ctx.publicKey);
  const { items, limit, offset } = await invoiceService.listForMerchant(merchant.id, params);
  return ok({ items, limit, offset });
}

export async function getInvoice(_req: NextRequest, ctx: HandlerContext) {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Missing session', 401);
  const { id } = await (ctx.params as Promise<{ id: string }>);
  const merchant = await merchantService.ensureFromPublicKey(ctx.publicKey);
  const invoice = await invoiceService.getForMerchant(merchant.id, id);
  // Best-effort settlement confirmation. If the customer already paid but
  // settlement hasn't been confirmed yet, attempt to confirm it now.
  if (invoice.status === 'paid' || invoice.status === 'settling') {
    settlementService.confirmForInvoice(invoice.id).catch((err: unknown) => {
      logger.warn('settlement.confirm_error', { invoiceId: invoice.id, err: String(err) });
    });
  }
  const sep7Uri = invoiceService.buildSep7Uri(invoice);
  const hubEvmAddress = env.HUB_EVM_ADDRESS ?? null;
  const evmIntent = (invoice.paymentIntents as PaymentIntent[]).find((pi) => pi.chain === 'base');
  const evmSourceTxHash = evmIntent?.evmTxHash ?? null;
  return ok({ ...invoice, sep7Uri, hubEvmAddress, evmSourceTxHash });
}

export async function cancelInvoice(_req: NextRequest, ctx: HandlerContext) {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Missing session', 401);
  const { id } = await (ctx.params as Promise<{ id: string }>);
  const merchant = await merchantService.ensureFromPublicKey(ctx.publicKey);
  const invoice = await invoiceService.cancel(merchant.id, id);
  return ok(invoice);
}

export async function getInvoiceBySignedId(_req: NextRequest, ctx: HandlerContext) {
  const { signedId } = await (ctx.params as Promise<{ signedId: string }>);
  const view = await invoiceService.getBySignedId(signedId);
  return ok(view);
}

export async function getInvoiceStatus(_req: NextRequest, ctx: HandlerContext) {
  const { signedId } = await (ctx.params as Promise<{ signedId: string }>);
  return ok(await invoiceService.getStatusBySignedId(signedId));
}

/**
 * SSE stream of invoice updates. Public (any client with the signedId may
 * subscribe). Emits an initial snapshot, then transitions from
 * `eventBus.subscribe('invoice.updated', …)`.
 */
export function streamInvoiceBySignedId(_req: NextRequest, _ctx: HandlerContext) {
  return createSseResponse(async (emit, signal) => {
    const { signedId } = await (_ctx.params as Promise<{ signedId: string }>);
    const current = await notificationService.getCurrentInvoiceBySignedId(signedId);
    if (!current) {
      emit('error', { code: 'NOT_FOUND', message: 'Invoice not found' });
      return;
    }
    emit('invoice.updated', {
      invoiceId: current.id,
      signedId: current.signedId,
      version: current.version,
      status: current.status,
      paidAt: current.paidAt,
      settledAt: current.settledAt,
      occurredAt: new Date(),
    });
    notificationService.subscribeInvoice(
      signedId,
      (evt) => {
        emit('invoice.updated', evt);
      },
      signal,
    );
    // Keep the handler alive until the client disconnects. Without this await,
    // the async function returns immediately and createSseResponse's finally
    // block aborts the stream right after the initial snapshot.
    await new Promise<void>((resolve) => {
      signal.addEventListener('abort', () => resolve(), { once: true });
    });
  });
}

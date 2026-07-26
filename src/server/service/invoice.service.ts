import { randomUUID } from 'node:crypto';
import { and, desc, eq, lt } from 'drizzle-orm';
import { env } from '@/server/config/env';
import { db } from '@/server/db/client';
import { type Invoice, invoices } from '@/server/db/schema/invoices';
import { type PaymentIntent, paymentIntents } from '@/server/db/schema/paymentIntents';
import { type Settlement, settlements } from '@/server/db/schema/settlements';
import { compareMinor, isMinorString } from '@/server/lib/bigint';
import { AppError } from '@/server/lib/http';
import { signInvoiceId, verifyInvoiceId } from '@/server/lib/signedId';
import { usdcCode, usdcIssuer } from '@/server/stellar/network';
import { merchantService } from './merchant.service';
import { transitionInvoice } from './stateTransitions.service';

const LIST_LIMIT_CAP = 200;
const LIST_DEFAULT_LIMIT = 20;

export type CreateInvoiceInput = {
  amountMinor: string;
  currency?: string;
  description?: string;
  ttlSeconds?: number;
};

export type CreateInvoiceResult = {
  invoice: Invoice;
  signedId: string;
  checkoutUrl: string;
  qrPayload: string;
};

export type InvoiceWithRelations = Invoice & {
  paymentIntents: PaymentIntent[];
  settlement: Settlement | null;
};

export type PublicInvoiceView = {
  id: string;
  amountMinor: string;
  currency: string;
  description: string | null;
  status: string;
  destinationAddress: string;
  destinationMemo: string | null;
  network: string;
  expiresAt: Date;
  paidAt: Date | null;
  settledAt: Date | null;
  createdAt: Date;
};

function assertMinor(value: string): void {
  if (!isMinorString(value) || value === '0') {
    throw new AppError('INVALID_INPUT', 'amountMinor must be a positive integer string', 400);
  }
  if (compareMinor(value, env.INVOICE_AMOUNT_MINOR_MAX.toString()) > 0) {
    throw new AppError('INVALID_INPUT', 'amountMinor exceeds maximum', 400);
  }
}

function buildCheckoutPath(signedId: string): string {
  return `/checkout/${signedId}`;
}

export const invoiceService = {
  async create(publicKey: string, input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
    const merchant = await merchantService.ensureFromPublicKey(publicKey, {
      network: env.STELLAR_NETWORK,
    });
    const ttl = input.ttlSeconds ?? env.INVOICE_DEFAULT_TTL_SECONDS;
    if (ttl <= 0 || ttl > 86_400) {
      throw new AppError('INVALID_INPUT', 'ttlSeconds must be between 1 and 86400', 400);
    }
    assertMinor(input.amountMinor);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    // For MVP: the customer pays directly to the merchant's wallet. The
    // destination memo is the signed id so the hub can correlate on-chain
    // payments back to invoices.
    const id = randomUUID();
    const signedId = signInvoiceId(id);

    const [row] = await db
      .insert(invoices)
      .values({
        id,
        merchantId: merchant.id,
        amountMinor: input.amountMinor,
        currency: input.currency ?? 'USD',
        description: input.description ?? null,
        status: 'pending',
        signedId,
        expiresAt,
        destinationAddress: merchant.walletAddress,
        destinationMemo: id,
        network: merchant.network,
      })
      .returning();

    // Create a default payment_intent (Stellar only for MVP).
    await db.insert(paymentIntents).values({
      invoiceId: id,
      chain: 'stellar',
      expectedAmountMinor: input.amountMinor,
      status: 'awaiting',
    });

    const checkoutPath = buildCheckoutPath(signedId);
    return {
      invoice: row,
      signedId,
      checkoutUrl: checkoutPath,
      qrPayload: checkoutPath,
    };
  },

  async listForMerchant(
    merchantId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<{ items: (Invoice & { stellarTxHash: string | null; evmSourceTxHash: string | null })[]; limit: number; offset: number }> {
    const limit = Math.min(Math.max(opts.limit ?? LIST_DEFAULT_LIMIT, 1), LIST_LIMIT_CAP);
    const offset = Math.max(opts.offset ?? 0, 0);
    const rows = await db
      .select()
      .from(invoices)
      .where(eq(invoices.merchantId, merchantId))
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset(offset);
    // Attach tx hashes for each invoice (batch: one query each for settlements + intents).
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return { items: [], limit, offset };
    const { inArray } = await import('drizzle-orm');
    const settleRows = await db
      .select({ invoiceId: settlements.invoiceId, stellarTxHash: settlements.stellarTxHash })
      .from(settlements)
      .where(inArray(settlements.invoiceId, ids));
    const intentRows = await db
      .select({ invoiceId: paymentIntents.invoiceId, evmTxHash: paymentIntents.evmTxHash })
      .from(paymentIntents)
      .where(and(inArray(paymentIntents.invoiceId, ids), eq(paymentIntents.chain, 'base')));
    const settleMap = new Map(settleRows.map((s) => [s.invoiceId, s.stellarTxHash]));
    const intentMap = new Map(intentRows.map((i) => [i.invoiceId, i.evmTxHash]));
    const items = rows.map((r) => ({
      ...r,
      stellarTxHash: settleMap.get(r.id) ?? null,
      evmSourceTxHash: intentMap.get(r.id) ?? null,
    }));
    return { items, limit, offset };
  },

  async getForMerchant(merchantId: string, id: string): Promise<InvoiceWithRelations> {
    const [row] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.merchantId, merchantId)))
      .limit(1);
    if (!row) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    return this.hydrate(row);
  },

  async getBySignedId(signedId: string): Promise<PublicInvoiceView> {
    const verified = verifyInvoiceId(signedId);
    if (!verified) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    const [row] = await db.select().from(invoices).where(eq(invoices.id, verified.id)).limit(1);
    if (!row) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    return toPublicView(row);
  },

  async getStatusBySignedId(signedId: string): Promise<{
    status: string;
    version: number;
    settlement: { stellarTxHash: string | null; status: string } | null;
  }> {
    const verified = verifyInvoiceId(signedId);
    if (!verified) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    const [row] = await db.select().from(invoices).where(eq(invoices.id, verified.id)).limit(1);
    if (!row) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    const [settle] = await db
      .select()
      .from(settlements)
      .where(eq(settlements.invoiceId, row.id))
      .limit(1);
    return {
      status: row.status,
      version: row.version,
      settlement: settle ? { stellarTxHash: settle.stellarTxHash, status: settle.status } : null,
    };
  },

  async cancel(merchantId: string, id: string): Promise<Invoice> {
    const [row] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.merchantId, merchantId)))
      .limit(1);
    if (!row) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    if (row.status !== 'pending') {
      throw new AppError('INVALID_INPUT', `Cannot cancel invoice in status ${row.status}`, 409);
    }
    return transitionInvoice(row.id, 'expired', { actor: 'merchant', reason: 'cancelled' });
  },

  async hydrate(row: Invoice): Promise<InvoiceWithRelations> {
    const intents = await db
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.invoiceId, row.id));
    const [settle] = await db
      .select()
      .from(settlements)
      .where(eq(settlements.invoiceId, row.id))
      .limit(1);
    return { ...row, paymentIntents: intents, settlement: settle ?? null };
  },

  /** Bulk-expire pending invoices past their expiry. Returns the count. */
  async expireStale(now: Date = new Date()): Promise<number> {
    const stale = await db
      .select({ id: invoices.id, version: invoices.version })
      .from(invoices)
      .where(and(eq(invoices.status, 'pending'), lt(invoices.expiresAt, now)))
      .limit(100);
    let count = 0;
    for (const row of stale) {
      try {
        await transitionInvoice(row.id, 'expired', {
          actor: 'system',
          reason: 'expired',
          expectedVersion: row.version,
        });
        count += 1;
      } catch {
        // raced; ignore
      }
    }
    return count;
  },

  /**
   * Mark an invoice `paid` based on a validated on-chain payment. Also records
   * the `payment_intent` row and inserts a pending `settlements` row.
   */
  async recordPayment(input: {
    invoiceId: string;
    txHash: string;
    paymentId: string;
    from: string;
    amount: string;
    chain: 'stellar' | 'base';
    evmTxHash?: string;
    evmFromAddress?: string;
  }): Promise<Invoice> {
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, input.invoiceId)).limit(1);
    if (!inv) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    if (inv.status === 'paid' || inv.status === 'settling' || inv.status === 'settled') {
      return inv; // idempotent
    }
    if (inv.status !== 'pending') {
      throw new AppError('INVALID_INPUT', `Cannot mark paid from status ${inv.status}`, 409);
    }
    // Update the matching intent (if any) — the unique index rejects duplicates.
    const intent = await db
      .select()
      .from(paymentIntents)
      .where(and(eq(paymentIntents.invoiceId, inv.id), eq(paymentIntents.chain, input.chain)))
      .limit(1);
    if (intent[0]) {
      try {
        await db
          .update(paymentIntents)
          .set({
            status: 'detected',
            detectedAt: new Date(),
            sourceTxHash: input.txHash,
            stellarPaymentId: input.paymentId,
            ...(input.evmTxHash ? { evmTxHash: input.evmTxHash } : {}),
            ...(input.evmFromAddress ? { evmFromAddress: input.evmFromAddress } : {}),
          })
          .where(eq(paymentIntents.id, intent[0].id));
      } catch {
        // unique index conflict — already recorded
      }
    } else {
      // No pre-existing intent for this chain (e.g. Base bridge payment):
      // insert a new detected intent.
      try {
        await db.insert(paymentIntents).values({
          invoiceId: inv.id,
          chain: input.chain,
          expectedAmountMinor: inv.amountMinor,
          status: 'detected',
          detectedAt: new Date(),
          sourceTxHash: input.txHash,
          stellarPaymentId: input.paymentId,
          ...(input.evmTxHash ? { evmTxHash: input.evmTxHash } : {}),
          ...(input.evmFromAddress ? { evmFromAddress: input.evmFromAddress } : {}),
        });
      } catch {
        // unique index conflict — already recorded
      }
    }
    // Insert a pending settlement row.
    await db.insert(settlements).values({
      invoiceId: inv.id,
      amountMinor: inv.amountMinor,
      merchantWallet: inv.destinationAddress,
      stellarTxHash: input.txHash,
      stellarPaymentId: input.paymentId,
      status: 'pending',
    });
    return transitionInvoice(inv.id, 'paid', {
      actor: 'system',
      reason: 'detected_on_chain',
      meta: { txHash: input.txHash, from: input.from, amount: input.amount },
      expectedVersion: inv.version,
    });
  },

  async markSettling(
    invoiceId: string,
    opts: { txHash: string; paymentId: string; ledger?: string },
  ): Promise<Invoice> {
    return transitionInvoice(invoiceId, 'settling', {
      actor: 'system',
      reason: 'settlement_confirmed',
      meta: opts,
    });
  },

  async markSettled(
    invoiceId: string,
    opts: { txHash: string; ledger?: string },
  ): Promise<Invoice> {
    return transitionInvoice(invoiceId, 'settled', {
      actor: 'system',
      reason: 'settled',
      meta: opts,
    });
  },

  /** Build a SEP-7 `web+stellar:pay` URI for mobile wallet apps (Lobstr, xBull).
   *  memo_type=text with first 28 chars of the UUID (dashes removed) — within
   *  Stellar's 28-byte text memo limit and unique enough for invoice matching. */
  buildSep7Uri(invoice: Invoice): string {
    const n = BigInt(invoice.amountMinor);
    const whole = n / 100n;
    const frac = n % 100n;
    const amount = `${whole}.${frac.toString().padStart(2, '0')}`;
    const memoText = invoice.id.replace(/-/g, '').slice(0, 28);
    const params = new URLSearchParams({
      destination: invoice.destinationAddress,
      amount,
      asset_code: usdcCode(),
      asset_issuer: usdcIssuer(),
      memo: memoText,
      memo_type: 'text',
    });
    if (invoice.description) params.set('msg', invoice.description);
    return `web+stellar:pay?${params.toString()}`;
  },
};

function toPublicView(row: Invoice): PublicInvoiceView {
  return {
    id: row.id,
    amountMinor: row.amountMinor,
    currency: row.currency,
    description: row.description,
    status: row.status,
    destinationAddress: row.destinationAddress,
    destinationMemo: row.destinationMemo,
    network: row.network,
    expiresAt: row.expiresAt,
    paidAt: row.paidAt,
    settledAt: row.settledAt,
    createdAt: row.createdAt,
  };
}

import { eq, sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { invoices } from '@/server/db/schema/invoices';
import { type Settlement, settlements } from '@/server/db/schema/settlements';
import { AppError } from '@/server/lib/http';
import { getTransaction } from '@/server/stellar/tx';
import { invoiceService } from './invoice.service';

/**
 * Confirms an on-chain settlement. When the customer pays directly to the
 * merchant's wallet, the hub does not submit a transaction — the customer's
 * payment *is* the settlement. The service's job is therefore to:
 *   1. Verify the transaction actually succeeded on Horizon.
 *   2. Update the `settlements` row with the ledger number.
 *   3. Transition the invoice `paid → settling → settled` via the
 *      state-machine service.
 *
 * The Horizon stream/poller already detects the payment and marks the invoice
 * `paid`; this service handles the *settled* half of the lifecycle.
 */

export const settlementService = {
  async confirmForInvoice(invoiceId: string): Promise<Settlement> {
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
    if (!inv) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    if (inv.status === 'settled') {
      // Already settled — return the existing settlement row.
      const [row] = await db
        .select()
        .from(settlements)
        .where(eq(settlements.invoiceId, invoiceId))
        .limit(1);
      if (row) return row;
    }
    if (inv.status !== 'paid' && inv.status !== 'settling') {
      throw new AppError('INVALID_INPUT', `Cannot settle invoice in status ${inv.status}`, 409);
    }
    const [settle] = await db
      .select()
      .from(settlements)
      .where(eq(settlements.invoiceId, invoiceId))
      .limit(1);
    if (!settle) {
      throw new AppError('NOT_FOUND', 'Settlement record not found', 404);
    }
    if (!settle.stellarTxHash) {
      throw new AppError('INVALID_INPUT', 'Settlement has no tx hash', 409);
    }
    if (inv.status === 'paid') {
      await invoiceService.markSettling(invoiceId, {
        txHash: settle.stellarTxHash,
        paymentId: settle.stellarPaymentId ?? '',
        ledger: settle.ledger ?? undefined,
      });
    }
    // Verify on-chain.
    const tx = await getTransaction(settle.stellarTxHash);
    if (!tx.successful) {
      throw new AppError('INVALID_INPUT', 'Stellar transaction was not successful', 409);
    }
    const [updated] = await db
      .update(settlements)
      .set({
        status: 'completed',
        ledger: String(tx.ledger),
        completedAt: new Date(),
      })
      .where(eq(settlements.id, settle.id))
      .returning();
    await invoiceService.markSettled(invoiceId, {
      txHash: settle.stellarTxHash,
      ledger: String(tx.ledger),
    });
    return updated;
  },

  async listForMerchant(merchantId: string, limit = 20, offset = 0): Promise<Settlement[]> {
    return db
      .select({
        id: settlements.id,
        invoiceId: settlements.invoiceId,
        amountMinor: settlements.amountMinor,
        merchantWallet: settlements.merchantWallet,
        stellarTxHash: settlements.stellarTxHash,
        stellarPaymentId: settlements.stellarPaymentId,
        ledger: settlements.ledger,
        status: settlements.status,
        completedAt: settlements.completedAt,
        createdAt: settlements.createdAt,
      })
      .from(settlements)
      .innerJoin(invoices, eq(settlements.invoiceId, invoices.id))
      .where(eq(invoices.merchantId, merchantId))
      .orderBy(sql`${settlements.createdAt} desc`)
      .limit(limit)
      .offset(offset);
  },
};

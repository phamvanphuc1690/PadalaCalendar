import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { type Invoice, invoices } from '@/server/db/schema/invoices';
import { type Withdrawal, withdrawals } from '@/server/db/schema/withdrawals';
import { eventBus, type InvoiceEvent, type WithdrawalEvent } from '@/server/lib/eventBus';

/**
 * Notification fan-out. Sits on top of `eventBus` and exposes typed helpers
 * for SSE handlers. Each subscriber gets an `unsubscribe` function; they
 * should also pass an `AbortSignal` so the bus can clean up on disconnect.
 */
export const notificationService = {
  publishInvoiceUpdated(invoice: Invoice): void {
    const payload: InvoiceEvent = {
      invoiceId: invoice.id,
      signedId: invoice.signedId,
      version: invoice.version,
      status: invoice.status,
      paidAt: invoice.paidAt,
      settledAt: invoice.settledAt,
      occurredAt: new Date(),
    };
    eventBus.publish('invoice.updated', payload);
  },

  publishWithdrawalUpdated(withdrawal: Withdrawal): void {
    const payload: WithdrawalEvent = {
      withdrawalId: withdrawal.id,
      version: withdrawal.version,
      status: withdrawal.status,
      completedAt: withdrawal.completedAt,
      occurredAt: new Date(),
    };
    eventBus.publish('withdrawal.updated', payload);
  },

  subscribeInvoice(
    signedId: string,
    callback: (evt: InvoiceEvent) => void,
    signal?: AbortSignal,
  ): () => void {
    return eventBus.subscribe(
      'invoice.updated',
      (evt) => {
        if (evt.signedId === signedId) callback(evt);
      },
      signal,
    );
  },

  subscribeWithdrawal(
    withdrawalId: string,
    callback: (evt: WithdrawalEvent) => void,
    signal?: AbortSignal,
  ): () => void {
    return eventBus.subscribe(
      'withdrawal.updated',
      (evt) => {
        if (evt.withdrawalId === withdrawalId) callback(evt);
      },
      signal,
    );
  },

  /** Read the current row to seed an SSE stream with at-least-once state. */
  async getCurrentInvoiceBySignedId(signedId: string): Promise<Invoice | null> {
    const [row] = await db.select().from(invoices).where(eq(invoices.signedId, signedId)).limit(1);
    return row ?? null;
  },

  async getCurrentWithdrawal(id: string): Promise<Withdrawal | null> {
    const [row] = await db.select().from(withdrawals).where(eq(withdrawals.id, id)).limit(1);
    return row ?? null;
  },
};

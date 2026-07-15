import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import {
  INVOICE_STATUSES,
  type Invoice,
  type InvoiceStatus,
  invoices,
} from '@/server/db/schema/invoices';
import { type StateTransitionActor, stateTransitions } from '@/server/db/schema/stateTransitions';
import {
  WITHDRAWAL_STATUSES,
  type Withdrawal,
  type WithdrawalStatus,
  withdrawals,
} from '@/server/db/schema/withdrawals';
import { eventBus } from '@/server/lib/eventBus';
import { AppError } from '@/server/lib/http';
import { logger } from '@/server/lib/logger';

/**
 * State-machine guards for invoice and withdrawal transitions.
 *
 * Centralising them here means a service can't accidentally walk a row
 * backwards (settled → pending) or skip steps. The DB enum also enforces
 * the literal set, so even a buggy SQL UPDATE would fail.
 */

const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  pending: ['paid', 'expired', 'failed'],
  paid: ['settling', 'failed', 'expired'],
  settling: ['settled', 'failed'],
  settled: [],
  failed: [],
  expired: [],
};

const WITHDRAWAL_TRANSITIONS: Record<WithdrawalStatus, WithdrawalStatus[]> = {
  quoted: ['submitted', 'expired', 'failed'],
  submitted: ['processing', 'failed', 'refunded', 'expired'],
  processing: ['completed', 'refunded', 'failed'],
  completed: [],
  refunded: [],
  expired: [],
  failed: [],
};

function assertInvoiceTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  if (!INVOICE_STATUSES.includes(to)) {
    throw new AppError('INVALID_INPUT', `Unknown invoice status: ${to}`, 400);
  }
  if (from === to) return; // idempotent
  if (!INVOICE_TRANSITIONS[from].includes(to)) {
    throw new AppError('INVALID_INPUT', `Illegal invoice transition ${from} → ${to}`, 409);
  }
}

function assertWithdrawalTransition(from: WithdrawalStatus, to: WithdrawalStatus): void {
  if (!WITHDRAWAL_STATUSES.includes(to)) {
    throw new AppError('INVALID_INPUT', `Unknown withdrawal status: ${to}`, 400);
  }
  if (from === to) return;
  if (!WITHDRAWAL_TRANSITIONS[from].includes(to)) {
    throw new AppError('INVALID_INPUT', `Illegal withdrawal transition ${from} → ${to}`, 409);
  }
}

export type TransitionOptions = {
  actor: StateTransitionActor;
  reason?: string;
  meta?: Record<string, unknown>;
  /** When the version pre-update matches, run the transition. If the row was
   *  concurrently updated, the UPDATE returns 0 rows and we throw. */
  expectedVersion?: number;
};

/**
 * Atomic invoice transition. Performs:
 *   1. guard check,
 *   2. UPDATE ... SET status = ?, version = version + 1 WHERE id = ? AND version = ?,
 *   3. INSERT into state_transitions,
 *   4. publish SSE event.
 *
 * The optimistic version check guarantees two writers can't race to the same
 * new state — one will win, the other gets 409 and can re-read.
 */
export async function transitionInvoice(
  invoiceId: string,
  to: InvoiceStatus,
  opts: TransitionOptions,
): Promise<Invoice> {
  const [row] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!row) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
  assertInvoiceTransition(row.status, to);
  const expected = opts.expectedVersion ?? row.version;
  const updated = await db
    .update(invoices)
    .set({
      status: to,
      version: sql`${invoices.version} + 1`,
      updatedAt: new Date(),
      ...(to === 'paid' ? { paidAt: new Date() } : {}),
      ...(to === 'settled' ? { settledAt: new Date() } : {}),
    })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.version, expected)))
    .returning();
  const next = updated[0];
  if (!next) {
    throw new AppError('CONFLICT', 'Invoice was modified concurrently', 409);
  }
  await db.insert(stateTransitions).values({
    entityType: 'invoice',
    entityId: invoiceId,
    fromStatus: row.status,
    toStatus: to,
    actor: opts.actor,
    reason: opts.reason ?? null,
    meta: opts.meta ?? null,
  });
  eventBus.publish('invoice.updated', {
    invoiceId: next.id,
    signedId: next.signedId,
    version: next.version,
    status: next.status,
    paidAt: next.paidAt,
    settledAt: next.settledAt,
    occurredAt: new Date(),
  });
  logger.info('invoice.transition', {
    invoiceId,
    from: row.status,
    to,
    actor: opts.actor,
  });
  return next;
}

export async function transitionWithdrawal(
  withdrawalId: string,
  to: WithdrawalStatus,
  opts: TransitionOptions & {
    anchorAccount?: string;
    memo?: string;
    memoType?: 'text' | 'id' | 'hash' | 'return';
  },
): Promise<Withdrawal> {
  const [row] = await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.id, withdrawalId))
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND', 'Withdrawal not found', 404);
  assertWithdrawalTransition(row.status, to);
  const expected = opts.expectedVersion ?? row.version;
  const patch: Partial<Withdrawal> = {
    status: to,
    version: sql`${withdrawals.version} + 1` as unknown as number,
    updatedAt: new Date(),
    ...(to === 'completed' || to === 'refunded' ? { completedAt: new Date() } : {}),
    ...(opts.anchorAccount ? { withdrawAnchorAccount: opts.anchorAccount } : {}),
    ...(opts.memo ? { withdrawMemo: opts.memo } : {}),
    ...(opts.memoType ? { withdrawMemoType: opts.memoType } : {}),
  };
  const updated = await db
    .update(withdrawals)
    .set(patch)
    .where(and(eq(withdrawals.id, withdrawalId), eq(withdrawals.version, expected)))
    .returning();
  const next = updated[0];
  if (!next) {
    throw new AppError('CONFLICT', 'Withdrawal was modified concurrently', 409);
  }
  await db.insert(stateTransitions).values({
    entityType: 'withdrawal',
    entityId: withdrawalId,
    fromStatus: row.status,
    toStatus: to,
    actor: opts.actor,
    reason: opts.reason ?? null,
    meta: opts.meta ?? null,
  });
  eventBus.publish('withdrawal.updated', {
    withdrawalId: next.id,
    version: next.version,
    status: next.status,
    completedAt: next.completedAt,
    occurredAt: new Date(),
  });
  logger.info('withdrawal.transition', {
    withdrawalId,
    from: row.status,
    to,
    actor: opts.actor,
  });
  return next;
}

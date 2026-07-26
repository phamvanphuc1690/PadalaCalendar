import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { notifications, recipients, remittances } from '@/server/db/schema';
import { AppError } from '@/server/lib/http';
import { usdcCode, usdcIssuer } from '@/server/stellar/network';
import { getTransaction, getTransactionPayments, type HorizonPayment } from '@/server/stellar/tx';
import {
  getDemoRecentEvents,
  getDemoRecipient,
  getDemoRecipients,
  getDemoSchedules,
} from '@/server/demo-store';

const useDemoStore = () =>
  process.env.NODE_ENV !== 'test' &&
  (process.env.DEMO_MODE === 'true' || !process.env.DRIZZLE_DATABASE_URL);

export async function getRecipients() {
  if (useDemoStore()) return getDemoRecipients();
  return db.select().from(recipients).orderBy(desc(recipients.createdAt));
}

export async function getRecipient(id: string) {
  if (useDemoStore()) return getDemoRecipient(id);
  const [recipient] = await db.select().from(recipients).where(eq(recipients.id, id));
  if (!recipient) return null;
  const recipientRemittances = await db
    .select()
    .from(remittances)
    .where(eq(remittances.recipientId, id))
    .orderBy(desc(remittances.createdAt));
  return { ...recipient, remittances: recipientRemittances };
}

export async function getSchedules(recipientId?: string, status?: string) {
  if (useDemoStore()) return getDemoSchedules(recipientId, status);
  const all = await db
    .select({
      schedule: remittances,
      recipient: recipients,
    })
    .from(remittances)
    .leftJoin(recipients, eq(remittances.recipientId, recipients.id))
    .orderBy(desc(remittances.createdAt));

  return all.filter((row) => {
    if (recipientId && row.schedule.recipientId !== recipientId) return false;
    if (status && row.schedule.status !== status) return false;
    return true;
  });
}

export async function generateMonthlySchedules(_recipientId?: string) {
  if (useDemoStore()) return getDemoSchedules().map((row) => row.schedule).slice(0, 6);
  // Demo mode: schedules already seeded in DB; return existing remittances
  return db.select().from(remittances).orderBy(desc(remittances.createdAt)).limit(6);
}

export function horizonAmountToMinor(amount: string): bigint {
  if (!/^\d+(\.\d+)?$/.test(amount)) throw new AppError('CONFLICT', 'Invalid on-chain amount', 409);
  const [whole, fraction = ''] = amount.split('.');
  if (/[^0]/.test(fraction.slice(7))) throw new AppError('CONFLICT', 'On-chain amount has unsupported precision', 409);
  return BigInt(whole) * 10_000_000n + BigInt(fraction.slice(0, 7).padEnd(7, '0'));
}

function assertTransactionHash(txHash: string): string {
  if (typeof txHash !== 'string' || !/^[a-f0-9]{64}$/i.test(txHash)) {
    throw new AppError('INVALID_INPUT', 'txHash must be a 64-character Stellar transaction hash', 400);
  }
  return txHash.toLowerCase();
}

/**
 * Mark a remittance complete only after Horizon proves the exact payment.
 * Client input is treated as a lookup key, never as payment evidence.
 */
export async function markScheduleSent(id: string, txHashInput: string) {
  const txHash = assertTransactionHash(txHashInput);
  const rows = await db
    .select({ schedule: remittances, recipient: recipients })
    .from(remittances)
    .leftJoin(recipients, eq(remittances.recipientId, recipients.id))
    .where(eq(remittances.id, id))
    .limit(1);
  const row = rows[0];
  const recipient = row?.recipient;
  if (!row?.schedule || !recipient) throw new AppError('NOT_FOUND', 'Remittance schedule not found', 404);
  if (row.schedule.status === 'completed') {
    if (row.schedule.txHash === txHash) return { schedule: row.schedule, proof: { txHash, idempotent: true } };
    throw new AppError('CONFLICT', 'Remittance is already completed with a different transaction', 409);
  }

  const tx = await getTransaction(txHash);
  if (!tx.successful) throw new AppError('CONFLICT', 'Stellar transaction did not succeed', 409);
  const payments = await getTransactionPayments(txHash);
  let expectedMinor: bigint;
  try {
    expectedMinor = BigInt(row.schedule.amountUsdc);
  } catch {
    throw new AppError('CONFLICT', 'Remittance amount is invalid', 409);
  }
  const payment = payments.find((candidate: HorizonPayment) =>
    candidate.type === 'payment' &&
    candidate.transaction_hash?.toLowerCase() === txHash &&
    candidate.to === recipient.stellarAddress &&
    candidate.asset_code === usdcCode() &&
    candidate.asset_issuer === usdcIssuer() &&
    candidate.transaction_successful !== false &&
    horizonAmountToMinor(candidate.amount) === expectedMinor,
  );
  if (!payment) throw new AppError('CONFLICT', 'Transaction does not prove the scheduled USDC payment', 409);

  const [updated] = await db
    .update(remittances)
    .set({ status: 'completed', txHash, sentAt: new Date() })
    .where(and(eq(remittances.id, id), eq(remittances.status, row.schedule.status)))
    .returning();
  if (!updated) throw new AppError('CONFLICT', 'Remittance changed while being confirmed', 409);
  return {
    schedule: { ...updated, status: 'completed', txHash, sentAt: updated.sentAt ?? new Date() },
    proof: { txHash, ledger: tx.ledger, paymentId: payment.id },
  };
}

export async function getRecentEvents(limit = 10) {
  if (useDemoStore()) return getDemoRecentEvents(limit);
  return db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

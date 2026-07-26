import { randomUUID } from 'node:crypto';
import { db } from '@/server/db/client';
import {
  type NewSep24Withdrawal,
  type Sep24Withdrawal,
  sep24Withdrawals,
} from '@/server/db/schema/sep24Withdrawals';
import { generateAnchorTxId, generatePickupCode, usdcMinorToPhp } from '@/server/lib/remittance';

export type InitiateWithdrawalInput = {
  remittanceId: string;
  amountUsdc: string; // minor units
};

export async function initiateWithdrawal(input: InitiateWithdrawalInput): Promise<Sep24Withdrawal> {
  const amountPhp = usdcMinorToPhp(input.amountUsdc);
  const row: NewSep24Withdrawal = {
    id: randomUUID(),
    remittanceId: input.remittanceId,
    anchorTxId: generateAnchorTxId(),
    amountPhp,
    pickupCode: generatePickupCode(),
    status: 'pending',
    createdAt: new Date(),
  };
  const [created] = await db.insert(sep24Withdrawals).values(row).returning();
  return created;
}

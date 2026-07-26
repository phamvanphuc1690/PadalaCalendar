import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/stellar/network', () => ({
  usdcCode: () => 'USDC',
  usdcIssuer: () => 'GISSUER',
}));

vi.mock('@/server/stellar/tx', () => ({
  getTransaction: vi.fn(async () => ({ successful: true, ledger: 900 })),
  getTransactionPayments: vi.fn(async () => [{
    id: 'payment-1',
    to: 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37',
    amount: '86.2100000',
    asset_code: 'USDC',
    asset_issuer: 'GISSUER',
    transaction_hash: 'a3f9e2c8b1d7f4a6e2c8b1d7f4a6e2c8b1d7f4a6e2c8b1d7f4a6e2c8b1d7f4a6',
    transaction_successful: true,
    type: 'payment',
  }]),
}));

const recipientRow = {
  id: 'rcpt-nanay',
  name: 'Nanay Carmen',
  stellarAddress: 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37',
  corridor: 'PH',
  monthlyAmountUsdc: '86210000',
  sendDay: 1,
  relationship: 'Mother',
  kycVerified: true,
  pickupRef: null,
  createdAt: new Date('2026-01-01'),
};
const remittanceRow = {
  id: 'sched-nanay-2026-06',
  recipientId: 'rcpt-nanay',
  cycleLabel: '2026-06',
  dueDate: new Date('2026-06-01'),
  status: 'scheduled',
  txHash: null,
  amountUsdc: '862100000',
  createdAt: new Date('2026-06-01'),
};
const scheduleJoinRow = { schedule: remittanceRow, recipient: recipientRow };

const chainable = (rows: unknown[]) => {
  const obj: Record<string, unknown> = {};
  ['orderBy', 'where', 'limit', 'returning', 'from'].forEach((m) => {
    obj[m] = vi.fn().mockReturnValue(obj);
  });
  obj.leftJoin = vi.fn().mockReturnValue(obj);
  obj.set = vi.fn().mockReturnValue(obj);
  // The terminal call resolves with the rows.
  obj.then = (resolve: (v: unknown) => void) => Promise.resolve(rows).then(resolve);
  return obj;
};

let selectCalls = 0;

vi.mock('@/server/db/client', () => ({
  db: {
    select: vi.fn(() => {
      const results = [
        [recipientRow],
        [recipientRow],
        [remittanceRow],
        [scheduleJoinRow],
        [remittanceRow],
        [scheduleJoinRow],
      ];
      selectCalls += 1;
      return chainable(results[selectCalls - 1] ?? [scheduleJoinRow]);
    }),
    update: vi.fn(() => chainable([remittanceRow])),
  },
}));

describe('remittance.service', () => {
  it('getRecipients returns list ordered by createdAt', async () => {
    const { getRecipients } = await import('@/server/service/remittance.service');
    const result = await getRecipients();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Nanay Carmen');
    expect(result[0].corridor).toBe('PH');
  });

  it('getRecipient returns recipient with their remittance history', async () => {
    const { getRecipient } = await import('@/server/service/remittance.service');
    const result = await getRecipient('rcpt-nanay');
    expect(result).not.toBeNull();
    expect(result?.name).toBe('Nanay Carmen');
  });

  it('getSchedules returns schedule rows joined with recipient', async () => {
    const { getSchedules } = await import('@/server/service/remittance.service');
    const result = await getSchedules();
    expect(result).toHaveLength(1);
  });

  it('generateMonthlySchedules returns latest cycles', async () => {
    const { generateMonthlySchedules } = await import('@/server/service/remittance.service');
    const result = await generateMonthlySchedules();
    expect(Array.isArray(result)).toBe(true);
  });

  it('markScheduleSent verifies the exact Horizon payment before updating', async () => {
    const { markScheduleSent } = await import('@/server/service/remittance.service');
    const result = await markScheduleSent('sched-nanay-2026-06', 'a3f9e2c8b1d7f4a6e2c8b1d7f4a6e2c8b1d7f4a6e2c8b1d7f4a6e2c8b1d7f4a6');
    expect(result.schedule.status).toBe('completed');
    expect(result.proof.paymentId).toBe('payment-1');
  });

  it('rejects a client-supplied fake hash before touching the database', async () => {
    const { markScheduleSent } = await import('@/server/service/remittance.service');
    await expect(markScheduleSent('sched-nanay-2026-06', 'demo-fake-hash')).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
  });

  it('converts Horizon decimal USDC without precision loss', async () => {
    const { horizonAmountToMinor } = await import('@/server/service/remittance.service');
    expect(horizonAmountToMinor('86.210000')).toBe(862100000n);
    expect(() => horizonAmountToMinor('86.21000001')).toThrow();
  });
});

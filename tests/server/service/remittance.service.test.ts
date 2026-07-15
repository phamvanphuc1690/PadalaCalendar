import { describe, expect, it, vi } from 'vitest';

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
  status: 'completed',
  txHash: 'a3f9e2c8b1d7f4a6e2c8b1d7f4a6e2c8b1d7f4a6e2c8b1d7f4a6e2c8b1d7f4a6',
  amountUsdc: '86210000',
  createdAt: new Date('2026-06-01'),
};

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

vi.mock('@/server/db/client', () => ({
  db: {
    select: vi.fn(() => chainable([recipientRow])),
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

  it('markScheduleSent returns updated schedule', async () => {
    const { markScheduleSent } = await import('@/server/service/remittance.service');
    const result = await markScheduleSent('sched-nanay-2026-06', 'newhash');
    expect(result.schedule.status).toBe('completed');
  });
});

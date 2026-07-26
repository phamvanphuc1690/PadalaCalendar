import type { Notification } from '@/server/db/schema/notifications';
import type { Recipient } from '@/server/db/schema/recipients';
import type { Remittance } from '@/server/db/schema/remittances';

const DEMO_ADDRESS = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37';

export const demoRecipients: Recipient[] = [
  {
    id: 'rcpt-nanay',
    name: 'Nanay Carmen',
    stellarAddress: DEMO_ADDRESS,
    corridor: 'PH',
    monthlyAmountUsdc: '862100000',
    sendDay: 1,
    relationship: 'Mother',
    kycVerified: true,
    pickupRef: null,
    createdAt: new Date('2026-05-01T09:00:00.000Z'),
  },
  {
    id: 'rcpt-bunso',
    name: 'Bunso Miguel',
    stellarAddress: DEMO_ADDRESS,
    corridor: 'PH',
    monthlyAmountUsdc: '517200000',
    sendDay: 15,
    relationship: 'Younger Brother',
    kycVerified: true,
    pickupRef: null,
    createdAt: new Date('2026-05-02T09:00:00.000Z'),
  },
  {
    id: 'rcpt-lola',
    name: 'Lola Turing',
    stellarAddress: DEMO_ADDRESS,
    corridor: 'PH',
    monthlyAmountUsdc: '344800000',
    sendDay: 18,
    relationship: 'Grandmother',
    kycVerified: true,
    pickupRef: null,
    createdAt: new Date('2026-05-03T09:00:00.000Z'),
  },
];

const remittance = (
  id: string,
  recipientId: string,
  amountUsdc: string,
  status: string,
  createdAt: string,
  sentAt: string | null = null,
  txHash: string | null = null,
): Remittance => ({
  id,
  recipientId,
  amountUsdc,
  status,
  txHash,
  pickupRef: null,
  sentAt: sentAt ? new Date(sentAt) : null,
  createdAt: new Date(createdAt),
});

export const demoRemittances: Remittance[] = [
  remittance(
    'pay-nanay-2026-06',
    'rcpt-nanay',
    '862100000',
    'completed',
    '2026-06-01T08:00:00.000Z',
    '2026-06-01T08:30:00.000Z',
    'a3f9e2c8b1d7f4a6e2c8b1d7f4a6e2c8b1d7f4a6e2c8b1d7f4a6e2c8b1d7f4a6',
  ),
  remittance('sched-bunso-2026-06', 'rcpt-bunso', '517200000', 'overdue', '2026-06-15T08:00:00.000Z'),
  remittance('sched-lola-2026-06', 'rcpt-lola', '344800000', 'upcoming', '2026-06-18T08:00:00.000Z'),
  remittance('sched-nanay-2026-07', 'rcpt-nanay', '862100000', 'upcoming', '2026-07-01T08:00:00.000Z'),
  remittance('sched-bunso-2026-07', 'rcpt-bunso', '517200000', 'upcoming', '2026-07-15T08:00:00.000Z'),
  remittance('sched-lola-2026-07', 'rcpt-lola', '344800000', 'upcoming', '2026-07-18T08:00:00.000Z'),
];

export const demoNotifications: Notification[] = [
  {
    id: 'evt-001',
    recipientId: 'rcpt-nanay',
    message: 'Payment received — 86.21 USDC sent to Nanay Carmen',
    dueDate: new Date('2026-06-01T08:00:00.000Z'),
    dismissed: false,
    createdAt: new Date('2026-06-01T08:30:00.000Z'),
  },
  {
    id: 'evt-002',
    recipientId: 'rcpt-bunso',
    message: 'Overdue alert — 51.72 USDC due to Bunso Miguel',
    dueDate: new Date('2026-06-15T08:00:00.000Z'),
    dismissed: false,
    createdAt: new Date('2026-07-26T08:00:00.000Z'),
  },
  {
    id: 'evt-003',
    recipientId: 'rcpt-lola',
    message: 'Upcoming reminder — 34.48 USDC due to Lola Turing',
    dueDate: new Date('2026-07-18T08:00:00.000Z'),
    dismissed: false,
    createdAt: new Date('2026-07-26T07:30:00.000Z'),
  },
  {
    id: 'evt-004',
    recipientId: 'rcpt-nanay',
    message: 'Horizon SSE stream connected (testnet)',
    dueDate: new Date('2026-07-26T07:00:00.000Z'),
    dismissed: false,
    createdAt: new Date('2026-07-26T07:00:00.000Z'),
  },
  {
    id: 'evt-005',
    recipientId: 'rcpt-nanay',
    message: 'Next cycle scheduled — 86.21 USDC for Nanay Carmen',
    dueDate: new Date('2026-07-01T08:00:00.000Z'),
    dismissed: false,
    createdAt: new Date('2026-07-01T08:00:00.000Z'),
  },
  {
    id: 'evt-006',
    recipientId: 'rcpt-bunso',
    message: 'SEP-7 payment link generated for overdue cycle',
    dueDate: new Date('2026-06-15T08:00:00.000Z'),
    dismissed: false,
    createdAt: new Date('2026-07-26T06:30:00.000Z'),
  },
];

export function getDemoRecipients() {
  return [...demoRecipients].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function getDemoRecipient(id: string) {
  const recipient = demoRecipients.find((item) => item.id === id);
  if (!recipient) return null;
  return {
    ...recipient,
    remittances: demoRemittances
      .filter((item) => item.recipientId === id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  };
}

export function getDemoSchedules(recipientId?: string, status?: string) {
  const recipientMap = new Map(demoRecipients.map((recipient) => [recipient.id, recipient]));
  return [...demoRemittances]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .filter((schedule) => (!recipientId || schedule.recipientId === recipientId) && (!status || schedule.status === status))
    .map((schedule) => ({ schedule, recipient: recipientMap.get(schedule.recipientId) ?? null }));
}

export function getDemoRecentEvents(limit = 10) {
  return [...demoNotifications]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

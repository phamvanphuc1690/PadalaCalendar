import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { recipients } from '../src/server/db/schema/recipients';
import { schedules } from '../src/server/db/schema/schedules';
import { payments } from '../src/server/db/schema/payments';
import { horizonEvents } from '../src/server/db/schema/horizonEvents';

if (process.env.DEMO_MODE !== 'true' || process.env.STELLAR_NETWORK === 'public') {
  throw new Error(
    'seed-demo requires DEMO_MODE=true and a non-mainnet STELLAR_NETWORK; refusing to seed demo data on mainnet',
  );
}

const pool = new Pool({ connectionString: process.env.DRIZZLE_DATABASE_URL });
const db = drizzle(pool);

async function seed() {
  console.log('Seeding PadalaCalendar demo data...');

  // Clear in dependency order
  await db.delete(horizonEvents);
  await db.delete(payments);
  await db.delete(schedules);
  await db.delete(recipients);

  // Maria Santos OFW — 3 family members in Manila
  await db.insert(recipients).values([
    {
      id: 'rcpt-nanay',
      name: 'Nanay Carmen',
      stellarAddress: 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37',
      corridor: 'PH',
      monthlyAmountUsdc: '862100000', // 86.21 USDC ≈ ₱5,000
      sendDay: 1,
      relationship: 'Mother',
    },
    {
      id: 'rcpt-bunso',
      name: 'Bunso Miguel',
      stellarAddress: 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37',
      corridor: 'PH',
      monthlyAmountUsdc: '517200000', // 51.72 USDC ≈ ₱3,000
      sendDay: 15,
      relationship: 'Younger Brother',
    },
    {
      id: 'rcpt-lola',
      name: 'Lola Turing',
      stellarAddress: 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37',
      corridor: 'PH',
      monthlyAmountUsdc: '344800000', // 34.48 USDC ≈ ₱2,000
      sendDay: 18,
      relationship: 'Grandmother',
    },
  ]);

  // June 2026 schedules — mixed statuses
  await db.insert(schedules).values([
    {
      id: 'sched-nanay-2026-06',
      recipientId: 'rcpt-nanay',
      cycleLabel: '2026-06',
      dueDate: new Date('2026-06-01'),
      status: 'sent',
    },
    {
      id: 'sched-bunso-2026-06',
      recipientId: 'rcpt-bunso',
      cycleLabel: '2026-06',
      dueDate: new Date('2026-06-15'),
      status: 'overdue',
    },
    {
      id: 'sched-lola-2026-06',
      recipientId: 'rcpt-lola',
      cycleLabel: '2026-06',
      dueDate: new Date('2026-06-18'),
      status: 'upcoming',
    },
    {
      id: 'sched-nanay-2026-07',
      recipientId: 'rcpt-nanay',
      cycleLabel: '2026-07',
      dueDate: new Date('2026-07-01'),
      status: 'upcoming',
    },
    {
      id: 'sched-bunso-2026-07',
      recipientId: 'rcpt-bunso',
      cycleLabel: '2026-07',
      dueDate: new Date('2026-07-15'),
      status: 'upcoming',
    },
    {
      id: 'sched-lola-2026-07',
      recipientId: 'rcpt-lola',
      cycleLabel: '2026-07',
      dueDate: new Date('2026-07-18'),
      status: 'upcoming',
    },
  ]);

  // Confirmed payment for Nanay June
  await db.insert(payments).values([
    {
      id: 'pay-nanay-2026-06',
      recipientId: 'rcpt-nanay',
      amountUsdc: '862100000',
      txHash: 'a3f9e2c8b1d7f4a6e2c8b1d7f4a6e2c8b1d7f4a6e2c8b1d7f4a6e2c8b1d7f4a6',
      sentAt: new Date('2026-06-01T08:30:00Z'),
    },
  ]);

  // Horizon SSE events (notifications feed)
  await db.insert(horizonEvents).values([
    {
      id: 'evt-001',
      recipientId: 'rcpt-nanay',
      eventType: 'Payment received — 86.21 USDC sent to Nanay Carmen',
      dismissed: false,
    },
    {
      id: 'evt-002',
      recipientId: 'rcpt-bunso',
      eventType: 'Overdue alert — 51.72 USDC due 6 days ago to Bunso Miguel',
      dismissed: false,
    },
    {
      id: 'evt-003',
      recipientId: 'rcpt-lola',
      eventType: 'Upcoming reminder — 34.48 USDC due in 12 days to Lola Turing',
      dismissed: false,
    },
    {
      id: 'evt-004',
      recipientId: null,
      eventType: 'Horizon SSE stream connected (testnet)',
      dismissed: false,
    },
    {
      id: 'evt-005',
      recipientId: 'rcpt-nanay',
      eventType: 'Next cycle scheduled — 2026-07-01, 86.21 USDC',
      dismissed: false,
    },
    {
      id: 'evt-006',
      recipientId: 'rcpt-bunso',
      eventType: 'SEP-7 payment link generated for overdue cycle',
      dismissed: false,
    },
  ]);

  console.log('✅ Seed complete!');
  console.log('   3 recipients: Nanay Carmen, Bunso Miguel, Lola Turing');
  console.log('   6 schedules: Jun SENT/OVERDUE/UPCOMING + Jul 3x UPCOMING');
  console.log('   1 confirmed payment + 4 horizon events');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

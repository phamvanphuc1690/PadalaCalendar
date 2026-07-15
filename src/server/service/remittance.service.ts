import { desc, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { notifications, recipients, remittances } from '@/server/db/schema';

export async function getRecipients() {
  return db.select().from(recipients).orderBy(desc(recipients.createdAt));
}

export async function getRecipient(id: string) {
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
  // Demo mode: schedules already seeded in DB; return existing remittances
  return db.select().from(remittances).orderBy(desc(remittances.createdAt)).limit(6);
}

export async function markScheduleSent(id: string, txHash: string) {
  const [updated] = await db
    .update(remittances)
    .set({ status: 'completed', txHash, sentAt: new Date() })
    .where(eq(remittances.id, id))
    .returning();
  return { schedule: updated };
}

export async function getRecentEvents(limit = 10) {
  return db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

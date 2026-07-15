export function getDaysUntilDue(dueDate: Date): number {
  const now = new Date();
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffMs = due.getTime() - nowDate.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function formatCycleLabel(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function getScheduleStatus(
  dueDate: Date,
  sentAt: Date | null,
): 'upcoming' | 'overdue' | 'sent' {
  if (sentAt) return 'sent';
  const days = getDaysUntilDue(dueDate);
  return days < 0 ? 'overdue' : 'upcoming';
}

export function calcOnTimeRate(scheduleList: Array<{ status: string }>): number {
  if (scheduleList.length === 0) return 0;
  const sent = scheduleList.filter((s) => s.status === 'sent').length;
  return Math.round((sent / scheduleList.length) * 100);
}

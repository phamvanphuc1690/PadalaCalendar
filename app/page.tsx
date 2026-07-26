import { Calendar, Send, Users, Clock } from 'lucide-react';
import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { recipients, remittances } from '@/server/db/schema';
import { usdcToString, usdcToPhp } from '@/server/lib/usdc';
import { getScheduleStatus, getDaysUntilDue } from '@/server/lib/schedule';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const allRecipients = await db.select().from(recipients).orderBy(desc(recipients.createdAt));
  const allRemittances = await db.select().from(remittances).orderBy(desc(remittances.createdAt));

  const monthlyTotal = allRecipients.reduce((sum, r) => sum + BigInt(r.monthlyAmountUsdc), 0n);

  // Compute upcoming send dates per recipient
  const now = new Date();
  const recipientRows = allRecipients.map((r) => {
    const dueDate = new Date(now.getFullYear(), now.getMonth(), r.sendDay);
    if (dueDate < now) dueDate.setMonth(dueDate.getMonth() + 1);
    const days = getDaysUntilDue(dueDate);
    const lastRemittance = allRemittances.find((rem) => rem.recipientId === r.id);
    const status = getScheduleStatus(dueDate, lastRemittance?.sentAt ?? null);
    return { recipient: r, dueDate, days, status };
  });

  const overdueCount = recipientRows.filter((r) => r.status === 'overdue').length;
  const sentCount = allRemittances.filter((r) => r.status === 'completed').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50">
      {/* Header */}
      <header className="border-b border-blue-100 bg-white/95 backdrop-blur-sm shadow-sm sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-7 w-7 text-blue-600" />
            <span className="font-heading text-xl font-bold text-blue-700">PadalaCalendar</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard" className="text-slate-600 hover:text-blue-600 text-sm font-medium transition-colors">Dashboard</Link>
            <Link href="/recipients" className="text-slate-600 hover:text-blue-600 text-sm font-medium transition-colors">Recipients</Link>
            <Link href="/history" className="text-slate-600 hover:text-blue-600 text-sm font-medium transition-colors">History</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 mb-4">
          <Calendar className="h-3.5 w-3.5" />
          Stellar USDC · SEP-7 · SEP-23 · Horizon SSE
        </div>
        <h1 className="font-heading mb-4 text-5xl font-extrabold text-slate-800">
          Never miss a family{' '}
          <span className="text-blue-600">remittance</span> again
        </h1>
        <p className="mb-8 max-w-2xl mx-auto text-lg text-slate-600">
          Carlo Mendoza sends monthly padala to his family in Manila. PadalaCalendar
          schedules each transfer and generates a pre-filled SEP-7 link — instant Stellar USDC,
          zero missed payments.
        </p>

        {/* Urgent alert */}
        {overdueCount > 0 && (
          <div className="mb-8 inline-flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-3 shadow-sm">
            <Clock className="h-5 w-5 text-red-600" />
            <p className="text-sm font-semibold text-red-800">
              <strong>{overdueCount} overdue remittance{overdueCount > 1 ? 's' : ''}</strong> — tap Dashboard to send now
            </p>
          </div>
        )}

        <div className="flex justify-center gap-4 mb-16">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-base font-bold text-white hover:bg-blue-700 transition-colors shadow-md"
          >
            <Calendar className="h-5 w-5" /> View Schedule
          </Link>
          <Link
            href="/recipients"
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-6 py-3 text-base font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Users className="h-5 w-5" /> Manage Recipients
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto mb-16">
          <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm text-center">
            <div className="text-3xl font-extrabold text-blue-600">{allRecipients.length}</div>
            <div className="text-sm text-slate-500 mt-1">Recipients</div>
          </div>
          <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm text-center">
            <div className="text-3xl font-extrabold text-blue-600">{usdcToString(monthlyTotal)}</div>
            <div className="text-sm text-slate-500 mt-1">USDC / Month</div>
          </div>
          <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm text-center">
            <div className="text-3xl font-extrabold text-blue-600">{sentCount}</div>
            <div className="text-sm text-slate-500 mt-1">Sent Total</div>
          </div>
        </div>
      </section>

      {/* Upcoming remittances preview */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <h2 className="font-heading text-2xl font-bold text-slate-800 mb-6">Upcoming Remittances</h2>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Recipient</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Amount</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Due</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {recipientRows.map(({ recipient: r, dueDate, days, status }) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-blue-50/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="text-sm font-semibold text-slate-800">{r.name}</div>
                    <div className="text-xs text-slate-500">{r.corridor}</div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-sm font-bold text-blue-700">
                      {usdcToString(BigInt(r.monthlyAmountUsdc))} USDC
                    </div>
                    <div className="text-xs text-slate-400">
                      {usdcToPhp(BigInt(r.monthlyAmountUsdc))}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-sm text-slate-600">
                      {dueDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                    </div>
                    {status !== 'sent' && (
                      <div className={`text-xs ${days < 0 ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                        {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today!' : `${days}d left`}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
                      status === 'sent' ? 'bg-green-100 text-green-700' :
                      status === 'overdue' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
              {recipientRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-slate-400">
                    No recipients yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 pb-16 grid grid-cols-3 gap-6">
        {[
          { icon: Calendar, title: 'Calendar-Driven Scheduling', desc: 'Set a monthly send date per recipient. PadalaCalendar tracks every cycle automatically.' },
          { icon: Send, title: 'One-Tap SEP-7 Payment', desc: 'Pre-filled payment link opens your Stellar wallet. Sign and send — no form filling.' },
          { icon: Clock, title: 'Real-Time Horizon Feed', desc: 'Horizon SSE streams payment confirmations live. Instant status flip from UPCOMING → SENT.' },
        ].map(({ icon: Icon, title, desc: d }) => (
          <div key={title} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <Icon className="mb-3 h-8 w-8 text-blue-600" />
            <h3 className="font-heading text-base font-bold text-slate-800 mb-2">{title}</h3>
            <p className="text-sm text-slate-500">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

import { Calendar, Clock, History, Users, Zap } from 'lucide-react';
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { notifications, recipients, remittances } from '@/server/db/schema';
import { usdcToString } from '@/server/lib/usdc';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const allRemittances = await db
    .select({ remittance: remittances, recipient: recipients })
    .from(remittances)
    .leftJoin(recipients, eq(remittances.recipientId, recipients.id))
    .orderBy(desc(remittances.sentAt));

  const recentNotifications = await db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(10);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-blue-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-7 w-7 text-blue-600" />
            <span className="font-heading text-xl font-bold text-blue-700">PadalaCalendar</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/" className="text-slate-500 hover:text-blue-600 text-sm transition-colors">Home</Link>
            <Link href="/dashboard" className="text-slate-500 hover:text-blue-600 text-sm transition-colors">Dashboard</Link>
            <Link href="/recipients" className="text-slate-500 hover:text-blue-600 text-sm transition-colors">Recipients</Link>
          </nav>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 p-4 flex flex-col flex-shrink-0">
          <nav className="space-y-1">
            <Link href="/dashboard" className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50 text-sm transition-colors">
              <Clock className="h-4 w-4" /> Upcoming
            </Link>
            <Link href="/recipients" className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50 text-sm transition-colors">
              <Users className="h-4 w-4" /> Recipients
            </Link>
            <Link href="/history" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 font-semibold text-sm">
              <History className="h-4 w-4" /> History
            </Link>
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="font-heading text-2xl font-extrabold text-slate-800">Payment History</h1>
            <p className="text-slate-500 text-sm mt-1">All confirmed Stellar USDC remittances with transaction hashes</p>
          </div>

          {/* Payment Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-8">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Recipient</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Amount</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Sent</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">TX Hash</th>
                </tr>
              </thead>
              <tbody>
                {allRemittances.map(({ remittance: rem, recipient: r }) => (
                  <tr key={rem.id} className="border-t border-slate-100 hover:bg-blue-50/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="text-sm font-semibold text-slate-800">{r?.name ?? 'Unknown'}</div>
                      <div className="text-xs text-slate-500">{r?.corridor}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-sm font-bold text-blue-700">{usdcToString(BigInt(rem.amountUsdc))} USDC</div>
                    </td>
                    <td className="px-5 py-3">
                      {rem.sentAt ? (
                        <>
                          <div className="text-sm text-slate-600">
                            {rem.sentAt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                          <div className="text-xs text-slate-400">
                            {rem.sentAt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-slate-400">Pending</div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {rem.txHash ? (
                        <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded" title={rem.txHash}>
                          {rem.txHash.slice(0, 18)}...
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {allRemittances.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-slate-400">
                      No payment history yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Live Notification Feed */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-blue-600" />
              <h2 className="font-heading text-lg font-bold text-slate-800">Live Activity Feed</h2>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Horizon SSE</span>
            </div>
            <div className="bg-slate-900 rounded-2xl p-5 space-y-2 font-mono text-sm min-h-[160px]">
              {recentNotifications.map((n) => (
                <div key={n.id} className="flex items-center gap-3">
                  <span className="text-green-400">●</span>
                  <span className="text-slate-300">
                    <span className="text-blue-400">[PADALA]</span>
                    <span className="text-yellow-400"> {n.message}</span>
                  </span>
                  <span className="text-slate-600 text-xs ml-auto">
                    {n.createdAt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))}
              {recentNotifications.length === 0 && (
                <div className="text-slate-500 py-4">No notifications yet. Waiting for payments...</div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

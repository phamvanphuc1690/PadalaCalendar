import { Calendar, Clock, History, Users } from 'lucide-react';
import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { recipients, remittances } from '@/server/db/schema';
import { usdcToString, usdcToPhp } from '@/server/lib/usdc';

export const dynamic = 'force-dynamic';

export default async function RecipientsPage() {
  const allRecipients = await db.select().from(recipients).orderBy(desc(recipients.createdAt));
  const allRemittances = await db.select().from(remittances).orderBy(desc(remittances.createdAt));

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
            <Link href="/history" className="text-slate-500 hover:text-blue-600 text-sm transition-colors">History</Link>
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
            <Link href="/recipients" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 font-semibold text-sm">
              <Users className="h-4 w-4" /> Recipients
            </Link>
            <Link href="/history" className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50 text-sm transition-colors">
              <History className="h-4 w-4" /> History
            </Link>
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="font-heading text-2xl font-extrabold text-slate-800">
                Recipients ({allRecipients.length})
              </h1>
              <p className="text-slate-500 text-sm mt-1">Carlo Mendoza&apos;s family members who receive monthly padala</p>
            </div>
          </div>

          {allRecipients.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-blue-200 bg-white py-16 text-center">
              <Users className="mx-auto mb-3 h-10 w-10 text-blue-300" />
              <p className="font-heading text-lg font-semibold text-slate-500">No recipients yet</p>
              <p className="mt-1 text-sm text-slate-400">Run seed to add demo family members</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {allRecipients.map((r) => {
                const recipientRemittances = allRemittances.filter((rem) => rem.recipientId === r.id);
                const sentCount = recipientRemittances.filter((rem) => rem.status === 'completed').length;

                return (
                  <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <Users className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-heading text-lg font-bold text-slate-800">{r.name}</h3>
                            <p className="text-sm text-slate-500">Sent by {r.relationship}</p>
                          </div>
                        </div>
                        <div className="text-xs font-mono text-slate-400 mb-3 truncate">
                          {r.stellarAddress.slice(0, 20)}...{r.stellarAddress.slice(-8)}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">{r.corridor} Corridor</span>
                          <span className="text-xs text-slate-500">Day {r.sendDay} each month</span>
                          {sentCount > 0 && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">{sentCount} sent</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-2xl font-extrabold text-blue-700">
                          {usdcToString(BigInt(r.monthlyAmountUsdc))} USDC
                        </div>
                        <div className="text-sm text-slate-500">{usdcToPhp(BigInt(r.monthlyAmountUsdc))}/month</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

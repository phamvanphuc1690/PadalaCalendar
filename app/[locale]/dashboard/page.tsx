import { CalendarDays, Send, Bell, ChevronRight, Phone, MapPin, Repeat, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { getRecentEvents, getRecipients, getSchedules } from '@/server/service/remittance.service';
import { usdcToString, usdcToPhp } from '@/server/lib/usdc';
import { getScheduleStatus, getDaysUntilDue, calcOnTimeRate } from '@/server/lib/schedule';
import { buildSep7PayUri } from '@/server/lib/sep7';
import { env } from '@/server/config/env';

export const dynamic = 'force-dynamic';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default async function DashboardPage() {
  const allRecipients = await getRecipients();
  const allRemittances = (await getSchedules()).map((row) => row.schedule);
  const recentNotifications = await getRecentEvents(6);

  const monthlyTotal = allRecipients.reduce(
    (sum: bigint, r: { monthlyAmountUsdc: string }) => sum + BigInt(r.monthlyAmountUsdc),
    0n,
  );
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();

  const scheduleRows = allRecipients.map((r: (typeof allRecipients)[number]) => {
    const thisMonthDue = new Date(year, month, r.sendDay);
    const completedThisCycle = allRemittances.find(
      (rem: (typeof allRemittances)[number]) => rem.recipientId === r.id && rem.status === 'completed',
    );
    const sentThisCycle = Boolean(completedThisCycle);
    // If the date has passed AND we have not sent this cycle → overdue.
    // Otherwise show the upcoming date (this month if not yet sent, else next month).
    let dueDate: Date;
    let status: 'upcoming' | 'overdue' | 'sent';
    if (sentThisCycle) {
      dueDate = thisMonthDue;
      status = 'sent';
    } else if (thisMonthDue < new Date(year, month, today)) {
      dueDate = thisMonthDue;
      status = 'overdue';
    } else {
      dueDate = thisMonthDue;
      status = 'upcoming';
    }
    const days = getDaysUntilDue(dueDate);
    const sep7Uri = status === 'sent'
      ? ''
      : buildSep7PayUri({
          destination: r.stellarAddress,
          amount: usdcToString(BigInt(r.monthlyAmountUsdc)),
          assetCode: env.USDC_ASSET_CODE,
          assetIssuer: env.USDC_ASSET_ISSUER_TESTNET,
          memo: `PC-${r.id.slice(0, 8)}-${MONTH_NAMES[month].slice(0, 3).toUpperCase()}`,
          memoType: 'text',
        });
    return { recipient: r, dueDate, days, status, lastRemittance: completedThisCycle, sep7Uri };
  });

  const overdueCount = scheduleRows.filter((r: { status: string }) => r.status === 'overdue').length;
  const sentCount = allRemittances.filter((r: { status: string }) => r.status === 'completed').length;
  const upcomingCount = scheduleRows.filter((r: { status: string }) => r.status === 'upcoming').length;
  const onTimeRate = calcOnTimeRate(
    allRemittances.map((r: { status: string }) => ({ status: r.status === 'completed' ? 'sent' : 'upcoming' })),
  );

  const heroRow =
    scheduleRows.find((r: { status: string }) => r.status === 'overdue') ??
    scheduleRows.find((r: { status: string; days: number }) => r.status === 'upcoming' && r.days <= 3) ??
    scheduleRows[0];

  const cells: Array<{ day: number | null; dueRecipients: typeof scheduleRows }> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ day: null, dueRecipients: [] });
  for (let d = 1; d <= daysInMonth; d++) {
    const dueRecipients = scheduleRows.filter(
      (r: { dueDate: Date; status: string }) => r.dueDate.getDate() === d && r.dueDate.getMonth() === month,
    );
    cells.push({ day: d, dueRecipients });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50/40 via-white to-slate-50 flex flex-col">
      <header className="border-b border-cyan-100 bg-white/95 backdrop-blur-sm shadow-sm sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-7 w-7 text-cyan-600" />
            <span className="font-heading text-xl font-bold text-cyan-700">PadalaCalendar</span>
            <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold uppercase tracking-widest text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-full">
              Beta · PH corridor
            </span>
          </div>
          <nav className="hidden sm:flex items-center gap-1 sm:gap-3 text-sm">
            <Link href="/" className="text-slate-500 hover:text-cyan-700 transition-colors px-2 py-1">Home</Link>
            <Link href="/recipients" className="text-slate-500 hover:text-cyan-700 transition-colors px-2 py-1">Recipients</Link>
            <Link href="/history" className="text-slate-500 hover:text-cyan-700 transition-colors px-2 py-1">History</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-6 flex-1">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-cyan-700 font-semibold">Maria Santos · OFW, Singapore</p>
            <h1 className="font-heading text-3xl font-extrabold text-slate-800 mt-1">
              {MONTH_NAMES[month]} {year} Remittance Calendar
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {allRecipients.length} family recipient{allRecipients.length === 1 ? '' : 's'} ·{' '}
              {usdcToString(monthlyTotal)} USDC monthly commitment
            </p>
          </div>
          <div className="flex gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-xs font-bold text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> {sentCount} sent
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700">
              <AlertTriangle className="h-3.5 w-3.5" /> {overdueCount} overdue
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-100 px-3 py-1.5 text-xs font-bold text-cyan-700">
              <Clock className="h-3.5 w-3.5" /> {upcomingCount} upcoming
            </span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-bold text-slate-800">{MONTH_NAMES[month]} {year}</h2>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-slate-500"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Overdue</span>
                <span className="flex items-center gap-1 text-slate-500"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Due soon</span>
                <span className="flex items-center gap-1 text-slate-500"><span className="h-2.5 w-2.5 rounded-full bg-cyan-500" /> Upcoming</span>
                <span className="flex items-center gap-1 text-slate-500"><span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Sent</span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {DAY_LABELS.map((d, i) => (
                <div key={`${d}-${i}`} className="py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell, i) => {
                if (cell.day === null) {
                  return <div key={`empty-${i}`} className="h-20 rounded-lg bg-slate-50/50" />;
                }
                const isToday = cell.day === today;
                const hasDue = cell.dueRecipients.length > 0;
                const hasOverdue = cell.dueRecipients.some((r: { status: string }) => r.status === 'overdue');
                const hasDueSoon = cell.dueRecipients.some(
                  (r: { status: string; days: number }) => r.status === 'upcoming' && r.days <= 3 && r.days >= 0,
                );
                const allSent = cell.dueRecipients.length > 0 && cell.dueRecipients.every((r: { status: string }) => r.status === 'sent');
                const dotClass = allSent
                  ? 'bg-green-500'
                  : hasOverdue
                    ? 'bg-red-500'
                    : hasDueSoon
                      ? 'bg-amber-500'
                      : hasDue
                        ? 'bg-cyan-500'
                        : 'bg-transparent';
                return (
                  <div
                    key={`d-${cell.day}`}
                    className={`h-20 rounded-lg border p-1.5 flex flex-col ${
                      isToday
                        ? 'border-cyan-500 bg-cyan-50/60'
                        : hasOverdue
                          ? 'border-red-200 bg-red-50/40'
                          : 'border-slate-100 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isToday ? 'text-cyan-700' : 'text-slate-700'}`}>
                        {cell.day}
                      </span>
                      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                    </div>
                    <div className="mt-1 space-y-0.5 overflow-hidden">
                      {cell.dueRecipients.slice(0, 2).map((r: (typeof scheduleRows)[number]) => (
                        <div
                          key={r.recipient.id}
                          className="text-[10px] truncate font-semibold text-slate-700"
                          title={r.recipient.name}
                        >
                          {r.recipient.name.split(' ')[0]}
                        </div>
                      ))}
                      {cell.dueRecipients.length > 2 && (
                        <div className="text-[9px] text-slate-400">+{cell.dueRecipients.length - 2}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6">
              <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
                This month&apos;s schedule
              </h3>
              <div className="space-y-2">
                {scheduleRows.map(({ recipient: r, dueDate, days, status }: (typeof scheduleRows)[number]) => (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                      status === 'overdue'
                        ? 'border-red-200 bg-red-50/50'
                        : status === 'sent'
                          ? 'border-green-200 bg-green-50/40'
                          : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold ${
                          status === 'sent'
                            ? 'bg-green-500'
                            : status === 'overdue'
                              ? 'bg-red-500'
                              : 'bg-cyan-500'
                        }`}
                      >
                        {r.name.split(' ').map((p: string) => p[0]).slice(0, 2).join('')}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800 text-sm">{r.name}</div>
                        <div className="text-xs text-slate-500">
                          {r.relationship} · {r.corridor} · Day {r.sendDay}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-cyan-700 text-sm">
                        {usdcToString(BigInt(r.monthlyAmountUsdc))} USDC
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {usdcToPhp(BigInt(r.monthlyAmountUsdc))}
                      </div>
                    </div>
                    <div className="text-right min-w-[80px]">
                      <div className="text-xs font-semibold text-slate-700">
                        {dueDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                      </div>
                      <div
                        className={`text-[10px] font-bold uppercase ${
                          status === 'sent'
                            ? 'text-green-600'
                            : status === 'overdue'
                              ? 'text-red-600'
                              : days <= 3
                                ? 'text-amber-600'
                                : 'text-slate-400'
                        }`}
                      >
                        {status === 'sent'
                          ? 'Sent'
                          : days < 0
                            ? `${Math.abs(days)}d overdue`
                            : days === 0
                              ? 'Due today'
                              : `${days}d left`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {heroRow && (
              <div className="bg-white rounded-2xl border-2 border-cyan-200 shadow-sm p-5 sticky top-20">
                <div className="flex items-center gap-2 mb-3">
                  <Bell className="h-4 w-4 text-cyan-600" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-700">
                    {heroRow.status === 'overdue' ? 'Overdue action needed' : 'Due soon'}
                  </span>
                </div>
                <h3 className="font-heading text-xl font-extrabold text-slate-800">
                  {heroRow.recipient.name}
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  {heroRow.recipient.relationship} · {heroRow.recipient.corridor}
                </p>
                <div className="bg-cyan-50 rounded-xl p-3 mb-3">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-cyan-700">Send amount</div>
                  <div className="font-heading text-3xl font-extrabold text-cyan-700">
                    {usdcToString(BigInt(heroRow.recipient.monthlyAmountUsdc))}
                    <span className="text-sm font-semibold text-cyan-600 ml-1">USDC</span>
                  </div>
                  <div className="text-xs text-cyan-700/80 truncate">{usdcToPhp(BigInt(heroRow.recipient.monthlyAmountUsdc))} · Cebuana pickup</div>
                </div>
                <div className="space-y-2 text-xs text-slate-600 mb-4">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>Recipient gets SMS pickup ref once sent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>Cash pickup in 5,200+ MoneyGram / Cebuana branches</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Repeat className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {heroRow.status === 'overdue'
                        ? `${Math.abs(heroRow.days)} days past scheduled date`
                        : heroRow.days === 0
                          ? 'Scheduled for today'
                          : `Scheduled in ${heroRow.days} day${heroRow.days === 1 ? '' : 's'}`}
                    </span>
                  </div>
                </div>
                {heroRow.sep7Uri && (
                  <a
                    href={heroRow.sep7Uri}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white hover:bg-cyan-700 transition-colors shadow-sm"
                  >
                    <Send className="h-4 w-4" /> Send now via Freighter
                  </a>
                )}
                <Link
                  href="/recipients"
                  className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-cyan-200 px-4 py-2.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 transition-colors"
                >
                  Manage recipients <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-slate-700">
                  Recent notifications
                </h3>
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Live" />
              </div>
              <div className="space-y-2">
                {recentNotifications.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No notifications yet</p>
                ) : (
                  recentNotifications.map((n: (typeof recentNotifications)[number]) => (
                    <div key={n.id} className="flex gap-2 text-xs">
                      <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-cyan-500 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-slate-700 font-semibold line-clamp-2">{n.message}</div>
                        <div className="text-slate-400 text-[10px] mt-0.5">
                          {n.createdAt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-gradient-to-br from-cyan-500 to-cyan-700 rounded-2xl shadow-sm p-5 text-white">
              <div className="text-[10px] uppercase font-bold tracking-widest text-cyan-100 mb-1">
                On-time rate
              </div>
              <div className="font-heading text-4xl font-extrabold">{onTimeRate}%</div>
              <div className="text-xs text-cyan-100 mt-1">
                Across {allRemittances.length} padala cycle{allRemittances.length === 1 ? '' : 's'}
              </div>
              <div className="mt-3 h-2 rounded-full bg-cyan-900/30 overflow-hidden">
                <div className="h-full bg-white" style={{ width: `${onTimeRate}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

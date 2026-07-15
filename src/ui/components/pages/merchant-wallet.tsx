'use client';

import { ArrowLeftRight, ArrowUpToLine, Banknote, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link } from '@/i18n/routing';
import { SectionCard } from '@/ui/components/shared/section-card';
import { StatusBadge } from '@/ui/components/shared/status-badge';
import { Button } from '@/ui/components/ui/button';
import { Card, CardContent } from '@/ui/components/ui/card';
import { Skeleton } from '@/ui/components/ui/skeleton';
import { useFreighter } from '@/ui/hooks/useFreighter';
import { useMerchant, useMerchantStats } from '@/ui/hooks/useMerchant';
import { useWithdrawals } from '@/ui/hooks/useOfframp';
import { useSession } from '@/ui/hooks/useSession';
import { explorerAccountUrl } from '@/ui/lib/explorer';
import { formatAmount } from '@/ui/lib/format';
import { cn, truncateAddress } from '@/ui/lib/utils';

export function MerchantWalletClient() {
  const t = useTranslations('Wallet');
  const tNav = useTranslations('Nav');
  const router = useRouter();
  const { session, logout } = useSession();
  const { disconnect: disconnectFreighter } = useFreighter();
  const { stats, loading: statsLoading } = useMerchantStats();
  const { merchant } = useMerchant();
  const { withdrawals } = useWithdrawals();
  const [activityTab, setActivityTab] = useState<'payments' | 'cashout'>('payments');
  const pk = session.publicKey;

  const onDisconnect = async () => {
    await logout();
    disconnectFreighter();
    router.push('/');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Freighter</p>
            <p className="tnum text-xs text-muted-foreground">
              {pk ? truncateAddress(pk, 6, 6) : '—'} · {merchant?.network ?? '—'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {t('connected')}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDisconnect}
              className="rounded-full text-destructive"
            >
              <LogOut className="mr-1 h-3 w-3" />
              {tNav('disconnect')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <SectionCard variant="dark">
        {statsLoading || !stats ? (
          <>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-10 w-48" />
            <Skeleton className="mt-2 h-3 w-40" />
            <hr className="my-4 border-primary-foreground/10" />
            <Skeleton className="h-3 w-32" />
          </>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <p className="text-xs uppercase tracking-widest text-primary-foreground/70">
                {t('usdcBalance')}
              </p>
              <div className="flex gap-1">
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                >
                  <Link href="/wallet/send">
                    <ArrowUpToLine className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                >
                  <Link href="/wallet/convert">
                    <ArrowLeftRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
            <p className="tnum mt-2 text-4xl font-light text-primary-foreground">
              {formatAmount(stats.wallet.usdcBalance)}{' '}
              <span className="text-sm font-normal text-primary-foreground/70">USDC</span>
            </p>
            <p className="mt-2 text-xs text-primary-foreground/70">
              {`${stats.transactions} ${t('transactions')} · ${stats.invoices.settled} ${t('settled')}`}
            </p>
            <hr className="my-4 border-primary-foreground/10" />
            <p className="text-xs text-primary-foreground/70">
              {t('xlmBalance')} · {formatAmount(stats.wallet.xlmBalance)} XLM
            </p>
          </>
        )}
      </SectionCard>

      {stats?.wallet.usdcTrustline === false ? (
        <Card>
          <CardContent className="space-y-3 p-4 text-sm text-muted-foreground">
            <p>{t('trustlineMissing')}</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <a
                  href="https://laboratory.stellar.org/#txbuilder?network=test"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('setupTrustlineCta')}
                </a>
              </Button>
              {pk ? (
                <Button asChild size="sm" variant="ghost">
                  <a
                    href={explorerAccountUrl(merchant?.network ?? 'testnet', pk)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('viewOnExplorer')}
                  </a>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Button
        asChild
        className="h-14 w-full rounded-xl bg-blue-600 text-base font-semibold text-white hover:bg-blue-700"
      >
        <Link href="/cashout">
          <Banknote className="mr-2 h-5 w-5" />
          {t('actions.cashout')}
        </Link>
      </Button>

      <div className="space-y-2">
        <div className="flex items-center gap-1 rounded-full bg-muted p-1">
          {(['payments', 'cashout'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActivityTab(tab)}
              className={cn(
                'flex-1 rounded-full py-1.5 text-xs font-medium transition-colors',
                activityTab === tab
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab === 'payments' ? t('recentActivity') : 'Cash Out Activity'}
            </button>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            {activityTab === 'payments' ? (
              stats && stats.recentSettlements.length > 0 ? (
                <ul className="divide-y divide-border">
                  {stats.recentSettlements.map((s) => (
                    <li key={s.id} className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Settlement #{s.invoiceId.slice(0, 6)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(s.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="tnum text-sm font-medium text-foreground">
                          +{formatAmount(s.amountMinor)} USDC
                        </p>
                        <StatusBadge
                          status={s.completedAt ? 'settled' : 'pending'}
                          className="mt-1"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-6 text-center text-sm text-muted-foreground">{t('noActivity')}</p>
              )
            ) : withdrawals.length > 0 ? (
              <ul className="divide-y divide-border">
                {withdrawals.map((w) => (
                  <li key={w.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Cash Out #{w.id.slice(0, 6)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(w.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tnum text-sm font-medium text-foreground">
                        -{formatAmount(w.sourceAmountMinor)} USDC
                      </p>
                      <StatusBadge status={w.status} className="mt-1" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-6 text-center text-sm text-muted-foreground">No cashouts yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {merchant && pk ? (
        <p className="text-center text-[10px] text-muted-foreground">
          <a
            href={explorerAccountUrl(merchant.network, pk)}
            target="_blank"
            rel="noreferrer"
            className="hover:underline"
          >
            {t('viewOnExplorer')}
          </a>
        </p>
      ) : null}
    </div>
  );
}

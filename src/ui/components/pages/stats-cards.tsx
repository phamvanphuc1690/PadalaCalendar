'use client';

import { useTranslations } from 'next-intl';
import { SkeletonCard } from '@/ui/components/shared/skeleton-card';
import { Card, CardContent } from '@/ui/components/ui/card';
import { useInvoices } from '@/ui/hooks/useInvoices';
import { useMerchant, useMerchantStats } from '@/ui/hooks/useMerchant';
import { formatAmount } from '@/ui/lib/format';

export function StatsCards() {
  const t = useTranslations('Dashboard');
  const { stats, loading } = useMerchantStats();
  const { merchant } = useMerchant();

  if (loading || !stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card>
        <CardContent className="space-y-1.5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {t('usdcBalance')}
          </p>
          <p className="tnum text-3xl font-light text-foreground">
            {formatAmount(stats.wallet.usdcBalance)}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('usdcTrustline', { state: stats.wallet.usdcTrustline ? 'yes' : 'no' })}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-1.5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {t('transactions')}
          </p>
          <p className="tnum text-3xl font-light text-foreground">{stats.transactions}</p>
          <p className="text-xs text-muted-foreground">{t('settlements')}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-1.5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{t('pending')}</p>
          <p className="tnum text-3xl font-light text-foreground">{stats.invoices.pending}</p>
          <p className="text-xs text-muted-foreground">{t('invoices')}</p>
        </CardContent>
      </Card>
      {!merchant ? null : (
        <p className="sm:col-span-3 text-xs text-muted-foreground">
          {t('merchant', { name: merchant.name, network: merchant.network })}
        </p>
      )}
    </div>
  );
}

export function RecentInvoices() {
  const t = useTranslations('Dashboard');
  const { items, loading } = useInvoices({ limit: 5, offset: 0 });

  if (loading) {
    return (
      <Card>
        <CardContent>
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }
  if (items.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('noInvoices')}</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">{t('recentInvoices')}</h2>
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {items.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">#{inv.id.slice(0, 6)}</p>
                  <p className="text-xs text-muted-foreground">{inv.description ?? '—'}</p>
                </div>
                <div className="text-right">
                  <p className="tnum text-sm font-medium text-foreground">
                    {formatAmount(inv.amountMinor)} {inv.currency}
                  </p>
                  <p className="text-xs text-muted-foreground">{inv.status}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

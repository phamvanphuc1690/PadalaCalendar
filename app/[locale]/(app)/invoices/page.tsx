'use client';

import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { StatusBadge } from '@/ui/components/shared/status-badge';
import { Button } from '@/ui/components/ui/button';
import { Card, CardContent } from '@/ui/components/ui/card';
import { Skeleton } from '@/ui/components/ui/skeleton';
import { useInvoices } from '@/ui/hooks/useInvoices';
import { explorerTxUrl } from '@/ui/lib/explorer';
import { formatAmount } from '@/ui/lib/format';
import { truncateAddress } from '@/ui/lib/utils';

export default function InvoicesListPage() {
  const t = useTranslations('Invoices');
  const { items, loading, error } = useInvoices({ limit: 100, offset: 0 });

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="display-thin text-3xl text-foreground">{t('listTitle')}</h1>
        <Button asChild className="rounded-full">
          <Link href="/invoices/new">{t('newInvoice')}</Link>
        </Button>
      </div>
      {loading ? (
        <div
          className="overflow-x-auto rounded-lg border border-border"
          data-testid="invoices-table-skeleton"
        >
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder rows, no reorder
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="ml-auto h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <p className="text-destructive">{error}</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t('empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-blue-600 bg-blue-600 text-xs uppercase tracking-wider text-white">
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Source Tx</th>
                <th className="px-4 py-3 text-left">Settlement Tx</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((inv) => (
                <tr key={inv.id} className="transition-colors hover:bg-muted/40">
                  {/* ID + description */}
                  <td className="px-4 py-3">
                    <Link href={`/invoices/${inv.id}`} className="block">
                      <p className="font-medium text-foreground">#{inv.id.slice(0, 6)}</p>
                      <p className="text-xs text-muted-foreground">{inv.description ?? '—'}</p>
                    </Link>
                  </td>
                  {/* Source Tx — only for bridge payments (Sepolia) */}
                  <td className="px-4 py-3">
                    {inv.evmSourceTxHash ? (
                      <a
                        href={`https://sepolia.etherscan.io/tx/${inv.evmSourceTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-primary-deep hover:underline"
                      >
                        {truncateAddress(inv.evmSourceTxHash, 6, 4)}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  {/* Settlement Tx — Stellar */}
                  <td className="px-4 py-3">
                    {inv.stellarTxHash ? (
                      <a
                        href={explorerTxUrl(inv.network, inv.stellarTxHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-primary-deep hover:underline"
                      >
                        {truncateAddress(inv.stellarTxHash, 6, 4)}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  {/* Amount + status */}
                  <td className="px-4 py-3 text-right">
                    <Link href={`/invoices/${inv.id}`} className="block">
                      <p className="tnum font-medium text-foreground">
                        {formatAmount(inv.amountMinor)} {inv.currency}
                      </p>
                      <StatusBadge status={inv.status} className="mt-1" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

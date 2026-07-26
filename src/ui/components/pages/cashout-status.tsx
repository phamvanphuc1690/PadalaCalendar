'use client';

import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { SectionCard } from '@/ui/components/shared/section-card';
import { SkeletonDetail } from '@/ui/components/shared/skeleton-detail';
import { StatusBadge } from '@/ui/components/shared/status-badge';
import { Button } from '@/ui/components/ui/button';
import { Card, CardContent } from '@/ui/components/ui/card';
import { useWithdrawal } from '@/ui/hooks/useOfframp';
import { formatAmount } from '@/ui/lib/format';

const TERMINAL = new Set(['completed', 'refunded', 'failed', 'expired']);
const SYNC_INTERVAL_MS = 2_000;

export function CashoutStatusClient({ id }: { id: string }) {
  const t = useTranslations('CashOut');
  const { withdrawal, refresh } = useWithdrawal(id);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll /sync so the mock anchor auto-advances status → updates DB + refreshes UI.
  useEffect(() => {
    if (!id) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/offramp/withdrawals/${encodeURIComponent(id)}/sync`, {
          method: 'POST',
          credentials: 'include',
        });
        const json = await res.json();
        if (json.ok) {
          await refresh();
          if (TERMINAL.has(json.data?.status)) {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
          }
        }
      } catch {
        // ignore transient errors
      }
    };

    pollingRef.current = setInterval(poll, SYNC_INTERVAL_MS);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [id, refresh]);

  if (!withdrawal) {
    return <SkeletonDetail />;
  }

  const status = withdrawal.status;
  const Icon =
    status === 'completed'
      ? CheckCircle2
      : status === 'refunded' || status === 'failed'
        ? XCircle
        : Loader2;

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <Icon
          className={
            'h-10 w-10 ' +
            (status === 'completed'
              ? 'text-green-600'
              : status === 'failed' || status === 'refunded'
                ? 'text-red-500'
                : 'text-muted-foreground animate-pulse')
          }
        />
        <h1 className="display-thin text-3xl text-foreground">{t('statusTitle')}</h1>
        <StatusBadge status={status} />
      </div>

      <SectionCard>
        <Card className="border-0 shadow-none">
          <CardContent className="space-y-1.5 p-0 text-sm">
            <Row label={t('completed')}>
              {formatAmount(withdrawal.destinationAmount)} {withdrawal.destinationAsset.code}
            </Row>
            <Row label={t('reference')}>{withdrawal.anchorTxId ?? '—'}</Row>
            {withdrawal.stellarTxHash ? (
              <Row label="Stellar tx">
                <span className="font-mono text-[10px]">
                  {withdrawal.stellarTxHash.slice(0, 8)}…
                </span>
              </Row>
            ) : null}
          </CardContent>
        </Card>
        <Button
          type="button"
          onClick={() => {
            window.location.href = '/wallet';
          }}
          className="mt-6 w-full rounded-full bg-blue-600 text-white hover:bg-blue-700"
        >
          {t('done')}
        </Button>
      </SectionCard>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{children}</span>
    </div>
  );
}

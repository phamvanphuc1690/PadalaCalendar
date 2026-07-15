'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link } from '@/i18n/routing';
import { SectionCard } from '@/ui/components/shared/section-card';
import { SkeletonFormRows } from '@/ui/components/shared/skeleton-form-rows';
import { Button } from '@/ui/components/ui/button';
import { Card, CardContent } from '@/ui/components/ui/card';
import { useFreighter } from '@/ui/hooks/useFreighter';
import { useStartWithdrawal, useSubmitWithdrawal, useWithdrawal } from '@/ui/hooks/useOfframp';
import { useToast } from '@/ui/hooks/useToast';
import { apiGet } from '@/ui/lib/api';
import { timeUntil } from '@/ui/lib/explorer';
import { formatAmount } from '@/ui/lib/format';

export function CashoutConfirmClient() {
  const t = useTranslations('CashOut');
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get('withdrawalId');
  const { withdrawal } = useWithdrawal(id);
  const { start, starting } = useStartWithdrawal();
  const { submit } = useSubmitWithdrawal();
  const { signAuthEntry, connect, isConnected } = useFreighter();
  const { toast } = useToast();
  const [step, setStep] = useState<'idle' | 'starting' | 'building' | 'signing' | 'submitting'>(
    'idle',
  );

  if (!id) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center text-muted-foreground">
        Missing withdrawal id
      </div>
    );
  }
  if (!withdrawal) {
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <SkeletonFormRows rows={4} />
      </div>
    );
  }

  const busy = step !== 'idle' || starting;

  const onConfirm = async () => {
    try {
      if (!isConnected) {
        const pk = await connect();
        if (!pk) {
          toast.error('Connect your Freighter wallet first');
          return;
        }
      }

      // 1. Start SEP-24 interactive withdrawal — persists anchorTxId.
      setStep('starting');
      await start(id);

      // 2. Build unsigned Stellar payment XDR (polls anchor until ready).
      setStep('building');
      const { xdr } = await apiGet<{ xdr: string }>(`/api/offramp/withdrawals/${id}/build`);

      // 3. Freighter signs the payment transaction.
      setStep('signing');
      const signedXdr = await signAuthEntry(xdr);

      // 4. Submit signed tx to Stellar and record the hash.
      setStep('submitting');
      await submit(id, signedXdr);

      toast.success('Payment sent to anchor');
      router.push(`/cashout/status/${encodeURIComponent(id)}`);
    } catch (err) {
      toast.error((err as Error).message);
      setStep('idle');
    }
  };

  const stepLabel: Record<typeof step, string> = {
    idle: t('confirm'),
    starting: 'Starting withdrawal…',
    building: 'Preparing transaction…',
    signing: 'Sign in Freighter…',
    submitting: 'Submitting to Stellar…',
  };

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="rounded-full">
        <Link href="/cashout">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('title')}
        </Link>
      </Button>
      <SectionCard>
        <h1 className="text-2xl font-light text-foreground">{t('confirmTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Locked quote — sign to confirm</p>

        <Card className="mt-6">
          <CardContent className="space-y-1.5 p-4 text-sm">
            <Row label={t('youSend')}>{formatAmount(withdrawal.sourceAmountMinor)} USDC</Row>
            <Row label={t('youGet')}>
              {formatAmount(withdrawal.destinationAmount)} {withdrawal.destinationAsset.code}
            </Row>
            <Row label={t('methodLabel')}>{withdrawal.payoutMethod.replace('_', ' ')}</Row>
            <Row label={t('expiresIn')}>{timeUntil(withdrawal.expiresAt)}</Row>
          </CardContent>
        </Card>

        <Button
          onClick={onConfirm}
          disabled={busy}
          className="mt-6 w-full rounded-full bg-blue-600 text-white hover:bg-blue-700"
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {stepLabel[step]}
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

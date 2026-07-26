'use client';

import { CheckCircle2, Loader2, Wallet as WalletIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ComingSoonPill } from '@/ui/components/shared/coming-soon-pill';
import { SectionCard } from '@/ui/components/shared/section-card';
import { SkeletonDetail } from '@/ui/components/shared/skeleton-detail';
import { Button } from '@/ui/components/ui/button';
import { Card, CardContent } from '@/ui/components/ui/card';
import { Skeleton } from '@/ui/components/ui/skeleton';
import { useCheckout } from '@/ui/hooks/useCheckout';
import { useFreighter } from '@/ui/hooks/useFreighter';
import { useInvoiceStream } from '@/ui/hooks/useInvoiceStream';
import { usePublicInvoice } from '@/ui/hooks/useInvoices';
import { useToast } from '@/ui/hooks/useToast';
import { formatAmount } from '@/ui/lib/format';

type Chain = 'stellar' | 'base' | 'ethereum';

const CHAINS: { key: Chain; name: string; subtitle: string; enabled: boolean }[] = [
  { key: 'stellar', name: 'Stellar USDC', subtitle: 'Native USDC on Stellar', enabled: true },
  { key: 'base', name: 'Base USDC', subtitle: 'USDC on Base', enabled: false },
  { key: 'ethereum', name: 'Ethereum USDC', subtitle: 'USDC on Ethereum', enabled: false },
];

export function CheckoutClient({ signedId }: { signedId: string }) {
  const t = useTranslations('Checkout');
  const router = useRouter();
  const { toast } = useToast();
  const { invoice, loading: invoiceLoading, error: invoiceError } = usePublicInvoice(signedId);
  const [chain, setChain] = useState<Chain>('stellar');
  const { challenge, verify, build, submit, busy } = useCheckout();
  const { isAvailable, isConnected, publicKey, connect, signAuthEntry } = useFreighter();
  const [stage, setStage] = useState<'pick' | 'connect' | 'pay' | 'submitted' | 'paid'>('pick');
  const [txHash, setTxHash] = useState<string | null>(null);

  // Auto-advance when the invoice becomes PAID via the public stream
  const { snapshot } = useInvoiceStream(signedId, (snap) => {
    if (snap.invoice.status === 'paid' || snap.invoice.status === 'settled') {
      setStage('paid');
      if (snap.settlement?.stellarTxHash) {
        setTxHash(snap.settlement.stellarTxHash);
      }
    }
  });

  useEffect(() => {
    if (snapshot?.invoice.status === 'paid' || snapshot?.invoice.status === 'settled') {
      setStage('paid');
    }
  }, [snapshot]);

  if (invoiceLoading) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <SkeletonDetail />
        <Skeleton className="mt-4 h-14 w-full rounded-xl" />
      </div>
    );
  }
  if (invoiceError || !invoice) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-destructive">{invoiceError ?? 'Invoice not found'}</p>
      </div>
    );
  }
  if (invoice.status === 'paid' || invoice.status === 'settled' || invoice.status === 'settling') {
    return <PaidView invoiceId={invoice.id} status={invoice.status} />;
  }
  if (invoice.status === 'expired' || invoice.status === 'failed') {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-muted-foreground">
          {invoice.status === 'expired' ? t('expired') : t('failed')}
        </p>
      </div>
    );
  }

  const onConnect = async () => {
    try {
      const pk = await connect();
      if (!pk) return;
      setStage('connect');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const onPay = async () => {
    if (!publicKey) return;
    setStage('pay');
    try {
      // 1) Challenge
      const { challenge: xdr } = await challenge(publicKey);
      // 2) Sign
      const signedXdr = await signAuthEntry(xdr);
      if (!signedXdr) throw new Error('Signing failed');
      // 3) Verify
      await verify(publicKey, signedXdr);
      // 4) Build
      const { xdr: paymentXdr } = await build(signedId);
      // 5) Sign payment
      const signedPayment = await signAuthEntry(paymentXdr);
      if (!signedPayment) throw new Error('Payment signing failed');
      // 6) Submit
      const { txHash: hash } = await submit(signedId, signedPayment);
      setTxHash(hash);
      setStage('submitted');
    } catch (err) {
      toast.error((err as Error).message);
      setStage('pick');
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-10">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">PayHub</p>
        <h1 className="mt-1 display-thin text-4xl text-foreground">
          {t('pay')} {formatAmount(invoice.amountMinor)} {invoice.currency}
        </h1>
        {invoice.description ? (
          <p className="mt-1 text-sm text-muted-foreground">{invoice.description}</p>
        ) : null}
      </div>

      <SectionCard>
        <p className="text-sm text-muted-foreground">{t('pickMethod')}</p>
        <div className="mt-3 space-y-2">
          {CHAINS.map((c) => (
            <button
              type="button"
              key={c.key}
              disabled={!c.enabled}
              onClick={() => c.enabled && setChain(c.key)}
              className={
                'flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ' +
                (c.enabled
                  ? chain === c.key
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/40'
                    : 'border-border hover:border-primary/40'
                  : 'cursor-not-allowed border-border/50 opacity-50')
              }
            >
              <div>
                <p className="text-sm font-medium text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.subtitle}</p>
              </div>
              {!c.enabled ? <ComingSoonPill /> : null}
              {c.enabled && chain === c.key ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : null}
            </button>
          ))}
        </div>
      </SectionCard>

      {!isAvailable ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            {t('installFreighter')}
          </CardContent>
        </Card>
      ) : !isConnected ? (
        <Button
          onClick={onConnect}
          className="w-full rounded-full"
          size="lg"
          data-testid="customer-connect"
        >
          <WalletIcon className="mr-2 h-4 w-4" />
          {t('connectWallet')}
        </Button>
      ) : (
        <div className="space-y-2">
          <Card>
            <CardContent className="p-3 text-xs text-muted-foreground">
              {t('connectedAs', { pk: `${publicKey?.slice(0, 4)}…${publicKey?.slice(-4)}` })}
            </CardContent>
          </Card>
          <Button
            onClick={onPay}
            disabled={busy || stage === 'pay' || stage === 'submitted'}
            className="w-full rounded-full"
            size="lg"
            data-testid="customer-pay"
          >
            {busy || stage === 'pay' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('payCta', { amount: formatAmount(invoice.amountMinor) })}
          </Button>
          {stage === 'submitted' ? (
            <p className="text-center text-xs text-muted-foreground">{t('waitingConfirm')}</p>
          ) : null}
          {txHash ? (
            <p className="break-all text-center text-[10px] text-muted-foreground">tx: {txHash}</p>
          ) : null}
        </div>
      )}

      <p className="text-center text-[10px] text-muted-foreground">
        <button type="button" onClick={() => router.push('/')} className="hover:underline">
          {t('poweredBy')}
        </button>
      </p>
    </div>
  );
}

function PaidView({ invoiceId, status }: { invoiceId: string; status: string }) {
  const t = useTranslations('Checkout');
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
      <h1 className="mt-4 display-thin text-3xl text-foreground">{t('paid')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('paidHint', { status })}</p>
      <p className="mt-3 text-xs text-muted-foreground">Invoice #{invoiceId.slice(0, 6)}</p>
    </div>
  );
}

'use client';

import { ArrowLeft, ArrowUpDown, CheckCircle2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link } from '@/i18n/routing';
import { SectionCard } from '@/ui/components/shared/section-card';
import { Button } from '@/ui/components/ui/button';
import { Card, CardContent } from '@/ui/components/ui/card';
import { Input } from '@/ui/components/ui/input';
import { useFreighter } from '@/ui/hooks/useFreighter';
import { useIdempotencyKey } from '@/ui/hooks/useIdempotencyKey';
import { useMerchantStats } from '@/ui/hooks/useMerchant';
import { useToast } from '@/ui/hooks/useToast';
import {
  type ConvertQuote,
  useConvertBuild,
  useConvertQuote,
  useConvertSubmit,
} from '@/ui/hooks/useWalletActions';
import { formatAmount, formatPercent } from '@/ui/lib/format';

const ASSETS: { code: string; issuer: string | null }[] = [
  { code: 'XLM', issuer: null },
  // Additional assets could be added here (e.g. yXLM, BTC, etc.)
];

export function ConvertClient() {
  const t = useTranslations('Convert');
  const router = useRouter();
  const { toast } = useToast();
  const { stats } = useMerchantStats();
  const { signAuthEntry, connect, isConnected } = useFreighter();
  const { get: getQuote, loading: quoting } = useConvertQuote();
  const { build, building } = useConvertBuild();
  const { submit, submitting } = useConvertSubmit();
  const idempotencyKey = useIdempotencyKey();

  const [amount, setAmount] = useState('100');
  const [slippageBps, setSlippageBps] = useState(50);
  const [destAsset, setDestAsset] = useState(ASSETS[0]);
  const [quote, setQuote] = useState<ConvertQuote | null>(null);
  const [stage, setStage] = useState<'pick' | 'review' | 'done'>('pick');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [usdcAfter, setUsdcAfter] = useState<string | null>(null);
  const [destAfter, setDestAfter] = useState<string | null>(null);

  const onReview = async () => {
    try {
      const q = await getQuote({
        destinationAssetCode: destAsset.code,
        ...(destAsset.issuer ? { destinationAssetIssuer: destAsset.issuer } : {}),
        amount: Math.round(Number(amount) * 100).toString(),
        slippageBps,
      });
      setQuote(q);
      setStage('review');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const onConfirm = async () => {
    if (!quote) return;
    if (!isConnected) {
      const pk = await connect();
      if (!pk) {
        toast.error('Wallet not connected');
        return;
      }
    }
    try {
      const built = await build(quote, idempotencyKey);
      const signed = await signAuthEntry(built.xdr);
      if (!signed) throw new Error('Signing failed');
      const { txHash: hash } = await submit(signed, idempotencyKey);
      setTxHash(hash);
      // Optimistic balance: subtract source, add destination min
      if (stats) {
        const usdcLeft = Math.max(
          0,
          Number(stats.wallet.usdcBalance) - Math.round(Number(amount) * 100),
        );
        setUsdcAfter(String(usdcLeft));
        setDestAfter(quote.suggestedMinDestination);
      }
      setStage('done');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (stage === 'done') {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
        <h1 className="mt-4 display-thin text-3xl text-foreground">{t('submitted')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('submittedHint', {
            fromAmount: amount,
            fromAsset: 'USDC',
            toAmount: formatAmount(quote?.destinationAmount ?? '0'),
            toAsset: destAsset.code,
          })}
        </p>
        <Card className="mt-6 text-left">
          <CardContent className="space-y-1.5 p-4 text-sm">
            <Row label={t('usdcBalanceAfter')}>{formatAmount(usdcAfter ?? '0')}</Row>
            <Row label={t('otherBalanceAfter', { asset: destAsset.code })}>
              {formatAmount(destAfter ?? '0', 4)} {destAsset.code}
            </Row>
            {txHash ? (
              <Row label="Tx">
                <span className="font-mono text-[10px]">{txHash.slice(0, 8)}…</span>
              </Row>
            ) : null}
          </CardContent>
        </Card>
        <Button onClick={() => router.push('/wallet')} className="mt-6 rounded-full">
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="rounded-full">
        <Link href="/wallet">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('title')}
        </Link>
      </Button>
      <SectionCard>
        <h1 className="text-2xl font-light text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>

        {stage === 'pick' ? (
          <div className="mt-6 space-y-4">
            <div>
              {/* biome-ignore lint/a11y/noLabelWithoutControl: Input below is the actual control */}
              <label className="text-xs text-muted-foreground">{t('from')}</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="tnum mt-1"
              />
            </div>
            <div className="flex justify-center">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              {/* biome-ignore lint/a11y/noLabelWithoutControl: asset buttons below are the actual controls */}
              <label className="text-xs text-muted-foreground">{t('to')}</label>
              <div className="mt-1 flex gap-2">
                {ASSETS.map((a) => (
                  <button
                    key={a.code}
                    type="button"
                    onClick={() => setDestAsset(a)}
                    className={
                      'h-10 flex-1 rounded-full border text-sm font-medium transition-colors ' +
                      (destAsset.code === a.code
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card hover:border-primary/40')
                    }
                  >
                    {a.code}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1 rounded-lg bg-canvas-soft p-3 text-sm">
              <Row label={t('slippage')}>{formatPercent(slippageBps / 10_000, 2)}</Row>
              <p className="text-xs text-muted-foreground">
                (default 0.5% — adjust in quote params)
              </p>
            </div>
            <Button
              onClick={onReview}
              disabled={quoting || !Number(amount)}
              className="w-full rounded-full"
            >
              {quoting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('review')}
            </Button>
          </div>
        ) : null}

        {stage === 'review' && quote ? (
          <div className="mt-6 space-y-4">
            <Card>
              <CardContent className="space-y-1.5 p-4 text-sm">
                <Row label={t('pay')}>{amount} USDC</Row>
                <Row label={t('receiveMin')}>
                  ≥ {formatAmount(quote.suggestedMinDestination, 4)} {destAsset.code}
                </Row>
                <Row label={t('route')}>Stellar DEX (path)</Row>
                <Row label={t('networkFee')}>{`< $0.01`}</Row>
              </CardContent>
            </Card>
            <Button
              onClick={onConfirm}
              disabled={building || submitting}
              className="w-full rounded-full"
            >
              {building || submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('confirm')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setStage('pick')}
              className="w-full rounded-full"
            >
              Back
            </Button>
          </div>
        ) : null}
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

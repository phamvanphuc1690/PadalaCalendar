'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link } from '@/i18n/routing';
import { SectionCard } from '@/ui/components/shared/section-card';
import { Button } from '@/ui/components/ui/button';
import { Card, CardContent } from '@/ui/components/ui/card';
import { Input } from '@/ui/components/ui/input';
import { useIdempotencyKey } from '@/ui/hooks/useIdempotencyKey';
import { useMerchantStats } from '@/ui/hooks/useMerchant';
import { useCreateQuote } from '@/ui/hooks/useOfframp';
import { useToast } from '@/ui/hooks/useToast';
import { formatAmount } from '@/ui/lib/format';
import { cn } from '@/ui/lib/utils';

const CURRENCIES = [
  { code: 'PHP', symbol: '₱', isoCode: 'iso4217:PHP', countryCode: 'PH' },
  { code: 'IDR', symbol: 'Rp', isoCode: 'iso4217:IDR', countryCode: 'ID' },
  { code: 'VND', symbol: '₫', isoCode: 'iso4217:VND', countryCode: 'VN' },
] as const;

export function CashoutQuoteClient() {
  const t = useTranslations('CashOut');
  const router = useRouter();
  const { toast } = useToast();
  const { stats } = useMerchantStats();
  const { create, creating } = useCreateQuote();
  const idempotencyKey = useIdempotencyKey();

  const [amount, setAmount] = useState('10');
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>(CURRENCIES[0]);
  const [quote, setQuote] = useState<{
    id: string;
    buyAmount: string;
    totalPrice: string;
    feeTotal: string;
    expiresAt: string;
  } | null>(null);

  const onContinue = async () => {
    try {
      const minor = Math.round(Number(amount) * 100).toString();
      const result = await create(
        {
          sellAsset: { code: 'USDC', issuer: null },
          buyAsset: { code: currency.isoCode, issuer: null },
          sellAmount: minor,
          buyDeliveryMethod: 'bank_deposit',
          countryCode: currency.countryCode,
        },
        idempotencyKey,
      );
      setQuote({
        id: result.id,
        buyAmount: result.buyAmount,
        totalPrice: result.totalPrice,
        feeTotal: result.feeTotal,
        expiresAt: result.expiresAt,
      });
      router.push(`/cashout/kyc?quoteId=${encodeURIComponent(result.id)}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

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

        <div className="mt-6 space-y-4">
          <Field label={t('convert')}>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="tnum"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {formatAmount(stats?.wallet.usdcBalance ?? '0')} USDC available
            </p>
          </Field>

          <Field label={t('receive')}>
            <div className="flex gap-2">
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={cn(
                    'h-10 flex-1 rounded-full border text-sm font-semibold transition-colors',
                    currency.code === c.code
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-border bg-card text-foreground hover:border-blue-400',
                  )}
                >
                  {c.symbol} {c.code}
                </button>
              ))}
            </div>
          </Field>

          {quote ? (
            <Card>
              <CardContent className="space-y-1.5 p-3 text-sm">
                <Row label={t('quote')}>
                  1 USDC = {(Number(quote.buyAmount) / Number(amount)).toFixed(2)} {currency.code}
                </Row>
                <Row label={t('fee')}>{formatAmount(quote.feeTotal, 0)}</Row>
                <Row label={t('youReceive')}>
                  <strong>
                    {currency.symbol}
                    {formatAmount(quote.buyAmount, 0)}
                  </strong>
                </Row>
              </CardContent>
            </Card>
          ) : null}

          <Button
            onClick={onContinue}
            disabled={creating || !Number(amount)}
            className="w-full rounded-full bg-blue-600 text-white hover:bg-blue-700"
          >
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('continue')}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      {/* biome-ignore lint/a11y/noLabelWithoutControl: child is a controlled Field, not a single input */}
      <label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
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

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Link } from '@/i18n/routing';
import { SectionCard } from '@/ui/components/shared/section-card';
import { Button } from '@/ui/components/ui/button';
import { Card, CardContent } from '@/ui/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/ui/components/ui/form';
import { Input } from '@/ui/components/ui/input';
import { Slider } from '@/ui/components/ui/slider';
import { useFreighter } from '@/ui/hooks/useFreighter';
import { useIdempotencyKey } from '@/ui/hooks/useIdempotencyKey';
import { useMerchantStats } from '@/ui/hooks/useMerchant';
import { useToast } from '@/ui/hooks/useToast';
import { useSendBuild, useSendSubmit } from '@/ui/hooks/useWalletActions';
import { formatAmount } from '@/ui/lib/format';
import { isValidPublicKey } from '@/ui/lib/stellar';
import { truncateAddress } from '@/ui/lib/utils';

type Step = 1 | 2 | 3 | 'done';

export function SendClient() {
  const t = useTranslations('Send');
  const router = useRouter();
  const { toast } = useToast();
  const { stats } = useMerchantStats();
  const { signAuthEntry, publicKey, isConnected, connect } = useFreighter();
  const { build, building } = useSendBuild();
  const { submit, submitting } = useSendSubmit();
  const idempotencyKey = useIdempotencyKey();

  const [step, setStep] = useState<Step>(1);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [signedXdr, setSignedXdr] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [slideValue, setSlideValue] = useState(0);

  const available = stats?.wallet.usdcBalance ?? '0';

  const goNext = () => {
    if (step === 1) {
      if (!isValidPublicKey(recipient)) {
        toast.error(t('invalidRecipient'));
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      const amt = Number(amount);
      if (!amt || amt <= 0) {
        toast.error('Enter an amount');
        return;
      }
      if (Number(available) < Math.round(amt * 100)) {
        toast.error(t('insufficient'));
        return;
      }
      setStep(3);
      return;
    }
  };

  const onSlideComplete = async () => {
    if (slideValue < 100) return;
    if (!publicKey) {
      // Re-connect then sign
      const pk = await connect();
      if (!pk) {
        toast.error('Wallet not connected');
        return;
      }
    }
    setSlideValue(0);
    try {
      const minor = Math.round(Number(amount) * 100).toString();
      const built = await build(
        {
          destination: recipient,
          amount: minor,
          ...(memo ? { memo: { type: 'text' as const, value: memo } } : {}),
        },
        idempotencyKey,
      );
      const signed = await signAuthEntry(built.xdr);
      if (!signed) throw new Error('Signing failed');
      setSignedXdr(signed);
      const { txHash: hash } = await submit(signed, idempotencyKey);
      setTxHash(hash);
      setStep('done');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (step === 'done') {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
        <h1 className="mt-4 display-thin text-3xl text-foreground">{t('success')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('successHint')}</p>
        <p className="mt-3 text-xs text-muted-foreground break-all">{txHash}</p>
        <Button onClick={() => router.push('/wallet')} className="mt-6 rounded-full">
          {t('done')}
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-light text-foreground">{t('title')}</h1>
          <span className="text-xs text-muted-foreground">
            {step === 1 ? t('step1') : step === 2 ? t('step2') : t('step3')}
          </span>
        </div>

        {step === 1 ? (
          <StepRecipient value={recipient} onChange={setRecipient} onNext={goNext} />
        ) : null}
        {step === 2 ? (
          <StepAmount
            amount={amount}
            memo={memo}
            available={available}
            onAmount={setAmount}
            onMemo={setMemo}
            onBack={() => setStep(1)}
            onNext={goNext}
          />
        ) : null}
        {step === 3 ? (
          <StepReview
            recipient={recipient}
            amount={amount}
            memo={memo}
            slideValue={slideValue}
            onSlide={setSlideValue}
            onSlideComplete={onSlideComplete}
            busy={building || submitting}
            onBack={() => setStep(2)}
          />
        ) : null}
      </SectionCard>
    </div>
  );
}

function StepRecipient({
  value,
  onChange,
  onNext,
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}) {
  const t = useTranslations('Send');
  return (
    <div className="mt-6 space-y-4">
      <div>
        {/* biome-ignore lint/a11y/noLabelWithoutControl: Input below is the actual control */}
        <label className="text-xs text-muted-foreground">{t('recipientLabel')}</label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('recipientPlaceholder')}
          className="mt-1 font-mono"
        />
        {value && isValidPublicKey(value) ? (
          <p className="mt-1 text-xs text-success">✓ Resolved: {truncateAddress(value, 6, 4)}</p>
        ) : null}
      </div>
      <Button onClick={onNext} className="w-full rounded-full">
        {t('review')}
      </Button>
    </div>
  );
}

const amountSchema = z.object({
  amount: z.string().min(1),
  memo: z.string().max(28).optional(),
});

function StepAmount({
  amount,
  memo,
  available,
  onAmount,
  onMemo,
  onBack,
  onNext,
}: {
  amount: string;
  memo: string;
  available: string;
  onAmount: (v: string) => void;
  onMemo: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useTranslations('Send');
  const form = useForm<z.infer<typeof amountSchema>>({
    resolver: zodResolver(amountSchema),
    defaultValues: { amount, memo },
  });

  return (
    <div className="mt-6 space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(() => onNext())} className="space-y-3">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('amountLabel')}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="tnum"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      onAmount(e.target.value);
                    }}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  {t('available', { amount: formatAmount(available) })}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="memo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('memoLabel')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      onMemo(e.target.value);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={onBack} className="rounded-full">
              {t('memoLabel') ? 'Back' : 'Back'}
            </Button>
            <Button type="submit" className="rounded-full">
              {t('review')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

function StepReview({
  recipient,
  amount,
  memo,
  slideValue,
  onSlide,
  onSlideComplete,
  busy,
  onBack,
}: {
  recipient: string;
  amount: string;
  memo: string;
  slideValue: number;
  onSlide: (v: number) => void;
  onSlideComplete: () => void;
  busy: boolean;
  onBack: () => void;
}) {
  const t = useTranslations('Send');
  return (
    <div className="mt-6 space-y-4">
      <Card>
        <CardContent className="space-y-1.5 p-4 text-sm">
          <Row label={t('to')}>
            <span className="font-mono text-xs">{truncateAddress(recipient, 8, 6)}</span>
          </Row>
          <Row label={t('amount')}>{amount} USDC</Row>
          <Row label={t('networkFee')}>{`< $0.01`}</Row>
          {memo ? <Row label={t('memo')}>{memo}</Row> : null}
        </CardContent>
      </Card>
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        className="w-full rounded-full"
        disabled={busy}
      >
        Back
      </Button>
      <div className="space-y-2">
        <p className="text-center text-xs text-muted-foreground">{t('slide')}</p>
        {busy ? (
          <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('submitting')}
          </div>
        ) : (
          <Slider
            value={[slideValue]}
            max={100}
            step={1}
            onValueChange={(v) => {
              const next = v[0] ?? 0;
              onSlide(next);
              if (next >= 100) onSlideComplete();
            }}
          />
        )}
      </div>
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

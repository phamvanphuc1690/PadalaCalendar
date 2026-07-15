'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Copy, Share2, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Link } from '@/i18n/routing';
import { QrImage } from '@/ui/components/shared/qr-image';
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
import { useMerchant } from '@/ui/hooks/useMerchant';
import { useToast } from '@/ui/hooks/useToast';
import { useReceiveRequest } from '@/ui/hooks/useWalletActions';
import { cn, truncateAddress } from '@/ui/lib/utils';

type Asset = 'USDC' | 'XLM';

export function ReceiveClient() {
  const t = useTranslations('Receive');
  const { merchant } = useMerchant();
  const { request, requesting } = useReceiveRequest();
  const { toast } = useToast();
  const [asset, setAsset] = useState<Asset>('USDC');
  const [requestQr, setRequestQr] = useState<{ uri: string; amount: string } | null>(null);

  const address = merchant?.walletAddress ?? '';
  const simpleQr = requestQr ? requestQr.uri : address;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success(t('requestCreated'));
    } catch {
      toast.error('Copy failed');
    }
  };

  const onShare = async () => {
    const shareData = {
      title: 'PayHub payment request',
      text: `Send ${asset} to ${address}`,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled
      }
    } else {
      onCopy();
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

        <div className="mt-6 flex gap-2">
          {(['USDC', 'XLM'] as Asset[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAsset(a)}
              className={cn(
                'h-10 flex-1 rounded-full border text-sm font-medium transition-colors',
                asset === a
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:border-primary/40',
              )}
            >
              {a}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          {address ? <QrImage value={simpleQr} size={200} /> : null}
          <p className="tnum break-all text-center text-xs text-muted-foreground">
            {address ? truncateAddress(address, 12, 12) : '—'}
          </p>
          <div className="flex w-full flex-col gap-2">
            <Button variant="outline" className="rounded-full" onClick={onCopy}>
              <Copy className="mr-2 h-4 w-4" />
              {t('copy')}
            </Button>
            <Button className="rounded-full" onClick={onShare}>
              <Share2 className="mr-2 h-4 w-4" />
              {t('share')}
            </Button>
          </div>
        </div>
      </SectionCard>

      <RequestAmountForm
        busy={requesting}
        onSubmit={async (values) => {
          try {
            const result = await request({
              amount: values.amount,
              memo: values.note,
              origin: typeof window !== 'undefined' ? window.location.origin : undefined,
              msg: values.note,
            });
            setRequestQr({ uri: result.uri, amount: result.amount });
            toast.success(t('requestCreated'));
          } catch (err) {
            toast.error((err as Error).message);
          }
        }}
      />
    </div>
  );
}

const reqSchema = z.object({
  amount: z
    .string()
    .min(1)
    .refine((v) => Number(v) > 0, 'Amount must be > 0'),
  note: z.string().max(80).optional(),
});
type ReqValues = z.infer<typeof reqSchema>;

function RequestAmountForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (values: ReqValues) => Promise<void> | void;
}) {
  const t = useTranslations('Receive');
  const form = useForm<ReqValues>({
    resolver: zodResolver(reqSchema),
    defaultValues: { amount: '', note: '' },
  });

  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Wallet className="h-4 w-4" />
          {t('requestAmountTitle')}
        </h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-3 space-y-3">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('amountLabel')}</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" className="tnum" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('noteLabel')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={busy} className="w-full rounded-full">
              {t('shareRequest')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

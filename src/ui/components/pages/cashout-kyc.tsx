'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Link } from '@/i18n/routing';
import { SectionCard } from '@/ui/components/shared/section-card';
import { Button } from '@/ui/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/ui/components/ui/form';
import { Input } from '@/ui/components/ui/input';
import { useIdempotencyKey } from '@/ui/hooks/useIdempotencyKey';
import { type PayoutMeta, useCreateWithdrawal } from '@/ui/hooks/useOfframp';
import { useToast } from '@/ui/hooks/useToast';

const kycSchema = z.object({
  fullName: z.string().min(1),
  idNumber: z.string().min(1),
  phone: z.string().min(1),
  bankName: z.string().min(1),
  accountNumber: z.string().min(1),
  accountName: z.string().min(1),
});
type KycValues = z.infer<typeof kycSchema>;

export function CashoutKycClient() {
  const t = useTranslations('CashOut');
  const router = useRouter();
  const params = useSearchParams();
  const quoteId = params.get('quoteId') ?? '';
  const { create, creating } = useCreateWithdrawal();
  const idempotencyKey = useIdempotencyKey();
  const { toast } = useToast();

  const form = useForm<KycValues>({
    resolver: zodResolver(kycSchema),
    defaultValues: {
      fullName: '',
      idNumber: '',
      phone: '',
      bankName: '',
      accountNumber: '',
      accountName: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!quoteId) {
      toast.error('Missing quote id');
      return;
    }
    const payoutMeta: PayoutMeta = {
      v: 1,
      kind: 'bank_deposit',
      data: {
        bankName: values.bankName,
        accountNumber: values.accountNumber,
        accountName: values.accountName,
      },
    };
    try {
      const result = await create(
        { quoteId, payoutMethod: 'bank_deposit', payoutMeta, ttlSeconds: 30 * 60 },
        idempotencyKey,
      );
      router.push(`/cashout/confirm?withdrawalId=${encodeURIComponent(result.id)}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  });

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="rounded-full">
        <Link href="/cashout">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('title')}
        </Link>
      </Button>
      <SectionCard>
        <h1 className="text-2xl font-light text-foreground">{t('kycTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('kycSubtitle')}</p>

        <Form {...form}>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fullName')}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="idNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('idNumber')}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('phone')}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bankName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bank name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="accountNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account number</FormLabel>
                  <FormControl><Input {...field} className="tnum" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="accountName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={creating}
              className="w-full rounded-full bg-blue-600 text-white hover:bg-blue-700"
            >
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('submitContinue')}
            </Button>
          </form>
        </Form>
      </SectionCard>
    </div>
  );
}

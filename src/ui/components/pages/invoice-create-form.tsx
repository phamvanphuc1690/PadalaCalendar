'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/ui/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/ui/components/ui/form';
import { Input } from '@/ui/components/ui/input';
import { useIdempotencyKey } from '@/ui/hooks/useIdempotencyKey';
import { useCreateInvoice } from '@/ui/hooks/useInvoices';
import { useMerchant } from '@/ui/hooks/useMerchant';
import { useToast } from '@/ui/hooks/useToast';

const schema = z.object({
  amount: z
    .string()
    .min(1)
    .refine((v) => Number(v) > 0, 'Amount must be greater than zero'),
  description: z.string().max(280).optional(),
  ttlMinutes: z.coerce
    .number()
    .int()
    .min(1)
    .max(60 * 24 * 7),
});

type FormValues = z.input<typeof schema>;
type ParsedValues = z.output<typeof schema>;

export function InvoiceCreateForm() {
  const t = useTranslations('Invoices');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const { merchant } = useMerchant();
  const { create, creating } = useCreateInvoice();
  const { toast } = useToast();
  const idempotencyKey = useIdempotencyKey();

  const form = useForm<FormValues, unknown, ParsedValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: { amount: '', description: '', ttlMinutes: 15 } as FormValues,
  });

  const onSubmit = form.handleSubmit(async (values: ParsedValues) => {
    try {
      const minor = Math.round(Number(values.amount) * 100).toString();
      const result = await create(
        {
          amountMinor: minor,
          currency: 'USDC',
          description: values.description || undefined,
          ttlSeconds: values.ttlMinutes * 60,
        },
        idempotencyKey,
      );
      toast.success(t('created'));
      router.push(`/invoices/${result.invoice.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-5">
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('amountLabel')}</FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="pl-7 tnum"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('descriptionLabel')}</FormLabel>
              <FormControl>
                <Input placeholder={t('descriptionPlaceholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="ttlMinutes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('ttlLabel')}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="1"
                  max="10080"
                  className="tnum"
                  {...field}
                  value={String(field.value ?? '')}
                />
              </FormControl>
              <FormDescription>{t('ttlHint')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/dashboard')}
            className="rounded-full"
          >
            {tCommon('cancel')}
          </Button>
          <Button
            type="submit"
            disabled={creating}
            className="rounded-full"
            data-testid="generate-qr"
          >
            {t('generate')}
          </Button>
        </div>
        {merchant ? (
          <p className="text-xs text-muted-foreground">
            {t('merchant', { name: merchant.name, network: merchant.network })}
          </p>
        ) : null}
      </form>
    </Form>
  );
}

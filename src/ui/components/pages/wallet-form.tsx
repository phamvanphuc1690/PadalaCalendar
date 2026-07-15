'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
import { isValidPublicKey } from '@/ui/lib/stellar';

const schema = z.object({
  publicKey: z
    .string()
    .min(56, 'publicKey too short')
    .max(56, 'publicKey too long')
    .refine(isValidPublicKey, { message: 'invalid' }),
  label: z.string().min(1).max(80),
});

type FormValues = z.infer<typeof schema>;

export function WalletForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (values: FormValues) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const t = useTranslations('Wallets.form');
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { publicKey: '', label: '' },
  });

  const handle = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await onSubmit(values);
      form.reset();
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={handle} className="space-y-4">
        <FormField
          control={form.control}
          name="publicKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('publicKeyLabel')}</FormLabel>
              <FormControl>
                <Input placeholder={t('publicKeyPlaceholder')} {...field} className="font-mono" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Label</FormLabel>
              <FormControl>
                <Input placeholder={t('labelPlaceholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t('cancel')}
            </Button>
          ) : null}
          <Button type="submit" disabled={submitting}>
            {t('submit')}
          </Button>
        </div>
      </form>
    </Form>
  );
}

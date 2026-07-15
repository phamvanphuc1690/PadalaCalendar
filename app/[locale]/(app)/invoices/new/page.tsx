'use client';

import { useTranslations } from 'next-intl';
import { InvoiceCreateForm } from '@/ui/components/pages/invoice-create-form';
import { SectionCard } from '@/ui/components/shared/section-card';

export default function NewInvoicePage() {
  const t = useTranslations('Invoices');
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <SectionCard>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-light text-foreground">{t('newTitle')}</h1>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">PayHub</span>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">{t('newSubtitle')}</p>
        <InvoiceCreateForm />
      </SectionCard>
    </div>
  );
}

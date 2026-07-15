'use client';

import { CheckCircle2, Clock, Hourglass } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { InvoiceCreateForm } from '@/ui/components/pages/invoice-create-form';
import { SectionCard } from '@/ui/components/shared/section-card';
import { useIdempotencyKey } from '@/ui/hooks/useIdempotencyKey';
import { useInvoiceStream } from '@/ui/hooks/useInvoiceStream';
import { useCreateInvoice } from '@/ui/hooks/useInvoices';
import { useToast } from '@/ui/hooks/useToast';

type Props = { initialSignedId?: string | null };

/**
 * Renders a create form. If `initialSignedId` is provided (from a previous
 * successful create), it shows the live status panel for that invoice and
 * auto-routes on settlement.
 */
export function NewInvoiceClient({ initialSignedId = null }: Props) {
  const t = useTranslations('Invoices');
  const router = useRouter();
  const { toast } = useToast();
  const idempotencyKey = useIdempotencyKey();

  // The form component handles its own submit and navigates. We expose a
  // hook here for any future inline UX (e.g. quick previews).
  useCreateInvoice();
  useIdempotencyKey();

  if (initialSignedId) {
    return <LiveStatus signedId={initialSignedId} />;
  }

  return (
    <SectionCard>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-light text-foreground">{t('newTitle')}</h1>
        <span className="text-xs uppercase tracking-widest text-muted-foreground">PayHub</span>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t('newSubtitle')}</p>
      <InvoiceCreateForm />
    </SectionCard>
  );
}

function LiveStatus({ signedId }: { signedId: string }) {
  const t = useTranslations('Invoices');
  const router = useRouter();
  const { snapshot } = useInvoiceStream(signedId, (snap) => {
    if (snap.invoice.status === 'settled') {
      router.replace(`/invoices/${snap.invoice.id}`);
    }
  });

  // TODO: surface a toast when the invoice settles. The useEffect below is
  // intentionally removed (was a no-op). Re-add once the toast library is
  // wired into this client component.

  const status = snapshot?.invoice.status ?? 'pending';
  const Icon = status === 'settled' ? CheckCircle2 : status === 'paid' ? Hourglass : Clock;

  return (
    <SectionCard>
      <div className="flex flex-col items-center gap-3 text-center">
        <Icon className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-light text-foreground">{t('waiting')}</h1>
        <p className="text-sm text-muted-foreground">{t('waitingHint')}</p>
        <p className="tnum text-xs text-muted-foreground break-all">{signedId}</p>
      </div>
    </SectionCard>
  );
}

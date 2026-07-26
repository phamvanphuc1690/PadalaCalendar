'use client';

import { use } from 'react';
import { InvoiceDetailClient } from '@/ui/components/pages/invoice-detail-client';

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <InvoiceDetailClient id={id} />;
}

'use client';

import { use } from 'react';
import { CashoutStatusClient } from '@/ui/components/pages/cashout-status';

export default function CashoutStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CashoutStatusClient id={id} />;
}

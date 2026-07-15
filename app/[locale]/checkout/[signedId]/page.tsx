'use client';

import { use } from 'react';
import { CheckoutClient } from '@/ui/components/pages/checkout-client';

export default function CheckoutPage({ params }: { params: Promise<{ signedId: string }> }) {
  const { signedId } = use(params);
  return <CheckoutClient signedId={decodeURIComponent(signedId)} />;
}

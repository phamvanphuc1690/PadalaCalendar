'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link } from '@/i18n/routing';
import { ProviderRow } from '@/ui/components/pages/provider-row';
import { SectionCard } from '@/ui/components/shared/section-card';
import { Button } from '@/ui/components/ui/button';
import { useFreighter } from '@/ui/hooks/useFreighter';
import { useSession } from '@/ui/hooks/useSession';
import { useToast } from '@/ui/hooks/useToast';
import { apiPost } from '@/ui/lib/api';

export default function ConnectPage() {
  const t = useTranslations('Connect');
  const tAuth = useTranslations('Auth');
  const tNav = useTranslations('Nav');
  const router = useRouter();
  const { isAvailable, loading, connect, signAuthEntry } = useFreighter();
  const { refresh } = useSession();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const onFreighter = async () => {
    setBusy(true);
    try {
      const pk = await connect();
      if (!pk) {
        toast.error(tAuth('challengeError'));
        return;
      }
      const { txXdr } = await apiPost<{ txXdr: string }>('/api/auth/challenge', { publicKey: pk });
      const signed = await signAuthEntry(txXdr);
      if (!signed) throw new Error('No signed auth entry returned');
      await apiPost('/api/auth/verify', { publicKey: pk, signedNonce: signed });
      await refresh();
      toast.success(t('connectedToast'));
      router.push('/dashboard');
    } catch {
      toast.error(tAuth('verifyError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Button asChild variant="ghost" size="sm" className="mb-6 rounded-full">
        <Link href="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('back')}
        </Link>
      </Button>
      <SectionCard>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-light text-foreground">{t('title')}</h1>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Stellar</span>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">{t('subtitle')}</p>
        <div className="space-y-3">
          {/* <ProviderRow provider="passkey" enabled={false} /> */}
          <ProviderRow provider="freighter" enabled={isAvailable} onClick={onFreighter} />
          {/* <ProviderRow provider="lobstr" enabled={false} />
          <ProviderRow provider="albedo" enabled={false} />
          <ProviderRow provider="walletconnect" enabled={false} /> */}
        </div>
        {/* Hide the Install CTA while the availability check is still
            in flight; otherwise it flashes for a frame on every page
            load before settling. */}
        {!loading && !isAvailable ? (
          <div className="mt-4 space-y-2">
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <a href="https://www.freighter.app/" target="_blank" rel="noreferrer">
                {tNav('installFreighter')}
              </a>
            </Button>
          </div>
        ) : null}
        {busy ? <p className="mt-3 text-xs text-muted-foreground">{t('signing')}</p> : null}
      </SectionCard>
    </div>
  );
}

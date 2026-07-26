'use client';

import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
// import { ComingSoonPill } from '@/ui/components/shared/coming-soon-pill';
import { cn } from '@/ui/lib/utils';

type ProviderKey = 'passkey' | 'freighter' | 'lobstr' | 'albedo' | 'walletconnect';

export function ProviderRow({
  provider,
  enabled,
  onClick,
}: {
  provider: ProviderKey;
  enabled: boolean;
  onClick?: () => void;
}) {
  const t = useTranslations('Connect');
  const meta: Record<ProviderKey, { name: string; subtitle: string; recommended?: boolean }> = {
    passkey: { name: t('passkeyName'), subtitle: t('passkeySubtitle'), recommended: true },
    freighter: { name: t('freighterName'), subtitle: t('freighterSubtitle') },
    lobstr: { name: t('lobstrName'), subtitle: t('lobstrSubtitle') },
    albedo: { name: t('albedoName'), subtitle: t('albedoSubtitle') },
    walletconnect: { name: t('walletconnectName'), subtitle: t('walletconnectSubtitle') },
  };
  const m = meta[provider];

  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={enabled ? onClick : undefined}
      className={cn(
        'group flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left ring-1 ring-foreground/5 transition-all',
        enabled
          ? 'border-border hover:border-primary/40 hover:shadow-sm'
          : 'cursor-not-allowed border-border/50 opacity-50',
      )}
    >
      <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/15 text-primary-deep">
        <span className="text-sm font-semibold">{m.name[0]}</span>
      </span>
      <span className="flex-1">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          {m.name}
        </span>
        <span className="block text-xs text-muted-foreground">{m.subtitle}</span>
      </span>
      {m.recommended ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary-subdued px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary-deep ring-1 ring-inset ring-primary/20">
          {t('recommended')}
        </span>
      ) : null}
      {/* {!enabled ? <ComingSoonPill /> : null} */}
      {enabled ? (
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      ) : null}
    </button>
  );
}

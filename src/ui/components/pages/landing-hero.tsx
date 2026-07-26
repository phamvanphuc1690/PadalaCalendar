'use client';

import { ArrowRight, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { publicEnv } from '@/server/config/env.public';
import { SectionCard } from '@/ui/components/shared/section-card';
import { Button } from '@/ui/components/ui/button';

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"
      />
    </svg>
  );
}

export function LandingHero() {
  const t = useTranslations('Hero');
  return (
    <section className="mx-auto max-w-6xl px-4 pt-24 pb-16 md:pt-36 md:pb-24">
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary-deep">
            <Sparkles className="h-3.5 w-3.5" />
            {t('eyebrow')}
          </p>
          <h1 className="display-thin-lg text-5xl leading-[1.05] text-foreground md:text-6xl">
            {t('title')
              .split('\n')
              .map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            {t('subtitle')}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-11 rounded-full px-6 text-sm font-medium">
              <Link href="/connect">
                {t('ctaPrimary')} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-11 rounded-full px-6 text-sm font-medium"
            >
              <a href={publicEnv.NEXT_PUBLIC_REPO_URL} target="_blank" rel="noreferrer">
                <GithubIcon className="mr-2 h-4 w-4" />
                {t('ctaSecondary')}
              </a>
            </Button>
          </div>
        </div>
        <SectionCard variant="default" className="relative overflow-hidden">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-glow-primary blur-3xl" />
          <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-glow-magenta blur-3xl" />
          <p className="text-xs uppercase tracking-widest text-primary-deep">Demo</p>
          <h2 className="mt-2 text-2xl font-light text-foreground">
            Accept crypto on any chain.
            <br />
            Get paid in USDC on Stellar.
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-surface-inset p-4">
              <p className="text-xs text-muted-foreground">USDC balance</p>
              <p className="tnum mt-1 text-2xl font-light text-foreground">1,260.00</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-inset p-4">
              <p className="text-xs text-muted-foreground">Transactions</p>
              <p className="tnum mt-1 text-2xl font-light text-foreground">61</p>
            </div>
          </div>
        </SectionCard>
      </div>
    </section>
  );
}

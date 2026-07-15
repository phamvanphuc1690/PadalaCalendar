'use client';

import { LandingHero } from '@/ui/components/pages/landing-hero';
import { GradientBg } from './gradient-bg';
import { PageTransition } from './page-transition';

export function MarketingHome() {
  return (
    <main>
      <GradientBg />
      <PageTransition>
        <LandingHero />
      </PageTransition>
    </main>
  );
}

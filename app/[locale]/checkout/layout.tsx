import type { ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import { BrandMark } from '@/ui/components/shared/brand-mark';
import { PageTransition } from '@/ui/components/shared/page-transition';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-4 py-4">
        <Link href="/" className="inline-flex">
          <BrandMark />
        </Link>
      </header>
      <main className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}

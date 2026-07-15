import type { Metadata, Viewport } from 'next';
import { Cal_Sans, Inter, Noto_Sans_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { routing } from '@/i18n/routing';
import { publicEnv } from '@/server/config/env.public';
import { PwaInstallPrompt } from '@/ui/components/pwa/pwa-install-prompt';
import { ServiceWorkerRegistration } from '@/ui/components/pwa/service-worker-registration';
import { Toaster } from '@/ui/components/ui/sonner';
import '../globals.css';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});
const calSans = Cal_Sans({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-heading',
  display: 'swap',
});
const notoSansMono = Noto_Sans_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // Read title/description from the active locale's message catalog so the
  // browser tab, search results, and social cards all localize with the URL.
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  const tBrand = await getTranslations({ locale, namespace: 'Hero' });
  const brandEyebrow = tBrand('eyebrow');
  const title = t('title');
  const description = t('description');
  const metadataBase = new URL(publicEnv.NEXT_PUBLIC_APP_URL);
  // Build a `languages` map for hreflang alternates. Each locale gets its
  // own entry; the default locale is also exposed at the unprefixed root.
  const languages: Record<string, string> = {};
  for (const loc of routing.locales) {
    languages[loc] = loc === routing.defaultLocale ? '/' : `/${loc}`;
  }
  return {
    metadataBase,
    title: {
      default: title,
      template: `%s · ${brandEyebrow}`,
    },
    description,
    applicationName: brandEyebrow,
    keywords: ['Stellar', 'USDC', 'merchant', 'crypto payments', 'payment hub'],
    authors: [{ name: brandEyebrow }],
    generator: 'Next.js',
    alternates: {
      canonical: '/',
      languages,
    },
    openGraph: {
      type: 'website',
      siteName: brandEyebrow,
      title,
      description,
      url: './',
      locale: locale.replace('-', '_'),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    icons: {
      icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

// PWA: Next.js 16 split `themeColor` (and other viewport-affecting fields)
// out of `metadata` into a separate `viewport` export. The manifest is
// served at /manifest.json by app/manifest.ts; theme_color is duplicated
// there so the OS-level install chrome matches the in-app address bar.
export const viewport: Viewport = {
  themeColor: '#1e40af',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} ${calSans.variable} ${notoSansMono.variable}`}
    >
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            {children}
            <ServiceWorkerRegistration />
            <PwaInstallPrompt />
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

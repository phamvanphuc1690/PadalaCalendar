import { setRequestLocale } from 'next-intl/server';
import { MarketingHome } from '@/ui/components/shared/marketing-home';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MarketingHome />;
}

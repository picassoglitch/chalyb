import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import type { AppLocale } from '@/i18n/locales';
import { Home } from '@/components/tools/chalito/Home';
import { HERO, Render, Showcase } from '@/components/tools/chalito/Showcase';

export const metadata: Metadata = { title: 'Chalito' };

export default async function ChalitoHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="grid gap-16">
      <section className="grid items-center gap-6 sm:grid-cols-2">
        <Home />
        <Render asset={HERO} locale={locale as AppLocale} eager className="mx-auto max-w-xs" />
      </section>
      <Showcase />
    </div>
  );
}

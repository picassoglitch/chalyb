import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { legacyClipSourceHref } from '@/lib/tools/clips-sources';

// Subir un video now lives on the one "Hacer clips" page (/app/clips/nuevo?fuente=archivo),
// management included. Old links (and the engine's redirect map) land here.

export default async function ClipsLegacySourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return redirect({ href: legacyClipSourceHref('archivo', await searchParams), locale });
}

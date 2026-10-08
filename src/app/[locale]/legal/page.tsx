import { redirect } from '@/i18n/routing';

// /legal has no index of its own: send readers (and old links / crawlers that
// strip the last segment) to the main legal document, keeping the locale.
// Without this, /legal and /en/legal answered 404.
export default async function LegalIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/legal/terms', locale });
}

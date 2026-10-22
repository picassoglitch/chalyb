import { NextResponse, type NextRequest } from 'next/server';
import { notificationTarget } from '@/lib/chalito/web/notification-link';

// Question notifications already sent carry the deep link "/s/<sid>" (migration 20261004003050), so
// /app/chalito/s/<sid> has to land on the session page (/sesiones/<sid>), not 404.
export async function GET(request: NextRequest, ctx: { params: Promise<{ locale: string; sid: string }> }) {
  const { locale, sid } = await ctx.params;
  const to = notificationTarget(`/s/${sid}`, locale === 'en' ? 'en' : 'es');
  if (!to) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(new URL(to, request.nextUrl.origin));
}

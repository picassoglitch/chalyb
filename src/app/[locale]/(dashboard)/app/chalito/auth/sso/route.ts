import { NextResponse, type NextRequest } from 'next/server';
import { NEXT_COOKIE_NAME, SSO_STATE_COOKIE_NAME, ssoLandingPath } from '@/lib/chalito/web/sso-landing';

// GET /app/chalito/auth/sso?token=…&next=…: where /auth/launch/chalito lands since Chalito moved
// into the hub (migration 0067). It was a 404; the token isn't needed here (HubBridge signs in).
export async function GET(request: NextRequest, ctx: { params: Promise<{ locale: string }> }) {
  const { locale } = await ctx.params;
  const to = ssoLandingPath(request.cookies.get(NEXT_COOKIE_NAME)?.value, locale);
  const res = NextResponse.redirect(new URL(to, request.nextUrl.origin));
  res.cookies.delete(NEXT_COOKIE_NAME);
  res.cookies.delete(SSO_STATE_COOKIE_NAME);
  // The URL carried a launch token: keep it out of the next page's Referer.
  res.headers.set('Referrer-Policy', 'no-referrer');
  return res;
}

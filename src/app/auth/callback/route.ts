import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeInternalPath } from '@/lib/auth/safe-path';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  // NEVER trust `next` as given. It is attacker-controlled in any link that
  // reaches an inbox, and this route redirects to it right after minting a
  // session — see src/lib/auth/safe-path.ts for what gets rejected.
  const next = safeInternalPath(url.searchParams.get('next'));

  const oauthError = url.searchParams.get('error');
  const oauthErrorDescription = url.searchParams.get('error_description');
  if (oauthError) {
    const msg = oauthErrorDescription ?? oauthError;
    console.error('OAuth provider error:', msg);
    return NextResponse.redirect(`${url.origin}/sign-in?error=${encodeURIComponent(msg)}`);
  }

  // Password recovery does NOT go through here anymore — the reset link lands
  // directly on /reset-password and verifies its token only when the user
  // submits a new password, so it never mints a roaming session. Refuse to
  // exchange a recovery code here (e.g. an old-style link still in an inbox):
  // bounce to the reset page WITHOUT creating a session, so a stale link can't
  // be used as a silent login. No token in the URL → the page just offers to
  // request a fresh link.
  if (next.includes('reset-password')) {
    // `next` is already a validated same-origin path here.
    return NextResponse.redirect(`${url.origin}${next}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${url.origin}${next}`);
    }
    console.error('Auth callback error:', error.message);
    return NextResponse.redirect(
      `${url.origin}/sign-in?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${url.origin}/sign-in?error=missing_code`);
}

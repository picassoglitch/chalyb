import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/auth/safe-next';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  // `next` is attacker-controllable: the whole point of this route is that a
  // link hands us one. Anything that isn't a same-origin path falls back to
  // /account rather than sending a freshly-authenticated browser off-site.
  const next = safeNextPath(url.searchParams.get('next'), '/account');

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
    // safeNextPath already guaranteed a leading slash and a same-origin path.
    return NextResponse.redirect(`${url.origin}${next}`);
  }

  // Team invites. The "Invite user" template (docs/email/templates/invite-user.html)
  // links here with the token hash instead of Supabase's hosted verify page:
  // that page hands the session back in a URL fragment, which a server route
  // never sees. Verifying the hash here is the same thing done server-side, and
  // it mints the cookies the same way the OAuth code exchange below does.
  // ONLY the invite type: recovery is refused above by design, and signup /
  // magic link keep using the code exchange.
  const tokenHash = url.searchParams.get('token_hash');
  const otpType = url.searchParams.get('type');
  if (tokenHash && otpType === 'invite') {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: 'invite', token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${url.origin}${next}`);
    }
    console.error('Auth callback invite error:', error.message);
    return NextResponse.redirect(
      `${url.origin}/sign-in?error=${encodeURIComponent(error.message)}`,
    );
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

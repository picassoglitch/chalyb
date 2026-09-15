// Diagnostic endpoint — verifies the Mercado Pago integration is healthy
// from the server side. Admin-only so we don't leak env-var state to users.
//
// Returns:
//   { ok: true, tokenPrefix, tokenKind, appUrl, isHttps, mpReachable }
//   { ok: false, error }
//
// `tokenKind` reports whether the configured token is TEST (sandbox) or
// APP_USR (production). Lets the operator confirm at a glance which mode
// they're in without exposing the whole secret.
//
// `mpReachable` is a real 7s read-only call: GET /users/me with the token.
// It creates nothing, works for test and production tokens alike, reports
// the account the token belongs to, and — unlike the SDK — surfaces the raw
// HTTP status when Mercado Pago rejects the credential with an empty body.

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';
import {
  isMercadoPagoConfigured,
  getAppUrl,
  getWebhookSecret,
} from '@/lib/payments/mercadopago';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface DiagResult {
  ok: boolean;
  error?: string;
  /** TEST | APP_USR | unknown */
  tokenKind?: string;
  /** First 8 chars of the token so operator can confirm the right key
   *  is set without us echoing the whole secret back. */
  tokenPrefix?: string | null;
  webhookSecretConfigured?: boolean;
  appUrl?: string;
  isHttps?: boolean;
  mpReachable?: boolean;
  mpResponseStatus?: number | null;
  mpResponseExcerpt?: string | null;
  /** Which read-only call was made. */
  probe?: 'users_me';
  elapsedMs?: number;
}

export async function GET(): Promise<NextResponse<DiagResult>> {
  const session = await getSessionUser();
  if (!session || !isAdminRole(session.role)) {
    return NextResponse.json(
      { ok: false, error: 'admin only' },
      { status: 403 },
    );
  }

  if (!isMercadoPagoConfigured()) {
    return NextResponse.json({
      ok: false,
      error: 'MERCADOPAGO_ACCESS_TOKEN no está configurada',
    });
  }

  const token =
    process.env.MERCADOPAGO_ACCESS_TOKEN ?? process.env.MP_ACCESS_TOKEN ?? '';
  const tokenKind = token.startsWith('TEST-')
    ? 'TEST (sandbox)'
    : token.startsWith('APP_USR-')
      ? 'APP_USR (production)'
      : 'unknown format';
  const tokenPrefix = token ? token.slice(0, 8) + '…' : null;
  const appUrl = getAppUrl();
  const isHttps = appUrl.startsWith('https://');

  // Real ping, WITHOUT the SDK: a raw GET /users/me with the token. The SDK
  // swallows the HTTP status when Mercado Pago answers an error with an
  // empty body (what its gateway does for a bad credential), and the status
  // is exactly what an operator needs here. Read-only, creates nothing,
  // works the same for test and production tokens, and says which account
  // the token belongs to.
  const started = Date.now();
  let mpReachable = false;
  let mpResponseStatus: number | null = null;
  let mpResponseExcerpt: string | null = null;
  const probe = 'users_me' as const;

  try {
    const res = await fetch('https://api.mercadopago.com/users/me', {
      headers: { Authorization: `Bearer ${token.trim()}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(7000),
      cache: 'no-store',
    });
    mpResponseStatus = res.status;
    const text = (await res.text().catch(() => '')) ?? '';
    if (res.ok) {
      mpReachable = true;
      try {
        const me = JSON.parse(text) as { id?: number; nickname?: string; site_id?: string };
        mpResponseExcerpt = `token válido · cuenta ${me.nickname ?? me.id ?? '?'} · site ${me.site_id ?? '?'}`;
      } catch {
        mpResponseExcerpt = 'token válido';
      }
    } else {
      mpResponseExcerpt = text
        ? text.slice(0, 200)
        : `respuesta vacía con HTTP ${res.status} — Mercado Pago rechazó la credencial`;
    }
    if (token !== token.trim()) {
      mpResponseExcerpt += ' · OJO: el token tiene espacios o saltos de línea al inicio o al final';
    }
  } catch (err) {
    mpReachable = false;
    mpResponseExcerpt = err instanceof Error ? err.message : 'unknown error';
  }

  return NextResponse.json({
    ok: mpReachable,
    tokenKind,
    tokenPrefix,
    webhookSecretConfigured: Boolean(getWebhookSecret()),
    appUrl,
    isHttps,
    mpReachable,
    mpResponseStatus,
    mpResponseExcerpt,
    probe,
    elapsedMs: Date.now() - started,
  });
}

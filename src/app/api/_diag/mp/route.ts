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
// `mpReachable` is a real 7s call to MP's preference endpoint.
//
// WHICH call depends on the token. A sandbox (TEST-*) token gets the original
// create-a-preference ping — a throwaway sandbox object, no consequences. A
// production (APP_USR-*) token gets a read-only SEARCH instead: creating a
// preference with a live token makes a REAL checkout, payable by anyone who
// gets the link, and leaves it in the merchant's account forever. A diagnostic
// endpoint must not be able to do that. `probe` says which one ran.

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';
import {
  isMercadoPagoConfigured,
  getMercadoPago,
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
  /** 'create' (sandbox token) or 'search' (production token, read-only). */
  probe?: 'create' | 'search';
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

  // Real ping. Build the smallest valid preference body possible and try
  // to create it. We don't actually use the result — we just want to
  // know if MP is reachable and if our token works.
  const started = Date.now();
  let mpReachable = false;
  let mpResponseStatus: number | null = null;
  let mpResponseExcerpt: string | null = null;

  // Only a sandbox token is allowed to create anything here.
  const isSandboxToken = token.startsWith('TEST-');
  const probe: 'create' | 'search' = isSandboxToken ? 'create' : 'search';

  try {
    const { preference } = getMercadoPago();
    if (isSandboxToken) {
      const result = await preference.create({
        body: {
          items: [
            {
              id: 'diag-ping',
              title: 'Diag · ping',
              quantity: 1,
              unit_price: 1,
              currency_id: 'MXN',
            },
          ],
          external_reference: `diag-ping-${Date.now()}`,
        },
      });
      mpResponseExcerpt = result.id ? `created sandbox preference id=${result.id}` : null;
    } else {
      // Read-only: proves the token authenticates and MP answers, creates
      // nothing. This is the path production takes.
      const result = await preference.search({ options: { limit: 1 } });
      mpResponseExcerpt =
        `search ok${typeof result.total === 'number' ? ` · ${result.total} preferencias en la cuenta` : ''}`;
    }
    mpReachable = true;
    mpResponseStatus = 200;
  } catch (err) {
    const e = err as {
      message?: string;
      status?: number;
      cause?: { error?: { message?: string }; status?: number };
    };
    mpReachable = false;
    mpResponseStatus =
      e?.cause?.status ?? e?.status ?? null;
    mpResponseExcerpt =
      e?.cause?.error?.message ?? e?.message ?? 'unknown error';
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

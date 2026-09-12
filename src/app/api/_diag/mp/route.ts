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
// `mpReachable` is a READ-ONLY probe: it asks MP to search our own recent
// payments. It used to create a real Preference on every call, which left a
// trail of junk checkout links in the MP dashboard — indistinguishable from
// real ones at a glance, and each one a live payable URL. A search exercises
// the same things (network path, token validity, account state) and creates
// nothing.
//
// A 4xx from MP still counts as "reachable" for network purposes, but an
// auth failure is reported through mpResponseStatus so the operator can tell
// "MP is down" from "our token is wrong".

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

  // Real ping, no side effects: a one-row payment search. Tells us whether MP
  // is reachable AND whether our token is accepted, without leaving anything
  // behind in the account.
  const started = Date.now();
  let mpReachable = false;
  let mpResponseStatus: number | null = null;
  let mpResponseExcerpt: string | null = null;

  try {
    const { payment } = getMercadoPago();
    // Search, not create. Limit 1 because we care whether MP answers, not
    // what it says.
    const result = await payment.search({ options: { limit: 1 } });
    mpReachable = true;
    mpResponseStatus = 200;
    const total = result?.paging?.total;
    mpResponseExcerpt =
      typeof total === 'number' ? `token OK · ${total} payment(s) visible` : 'token OK';
  } catch (err) {
    const e = err as {
      message?: string;
      status?: number;
      cause?: { error?: { message?: string }; status?: number };
    };
    mpReachable = false;
    mpResponseStatus = e?.cause?.status ?? e?.status ?? null;
    mpResponseExcerpt = e?.cause?.error?.message ?? e?.message ?? 'unknown error';
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
    elapsedMs: Date.now() - started,
  });
}

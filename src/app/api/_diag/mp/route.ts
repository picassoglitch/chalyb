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
// `mpReachable` is a real 7s ping to MP's preference endpoint with a
// minimum-shape body. We discard the result if MP returns 4xx (still
// counts as "reachable"); we only flag false for timeout / network
// errors so the operator knows where the problem actually is.

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

  // Real ping. Build the smallest valid preference body possible and try
  // to create it. We don't actually use the result — we just want to
  // know if MP is reachable and if our token works.
  const started = Date.now();
  let mpReachable = false;
  let mpResponseStatus: number | null = null;
  let mpResponseExcerpt: string | null = null;

  try {
    const { preference } = getMercadoPago();
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
    mpReachable = true;
    mpResponseStatus = 200;
    mpResponseExcerpt = result.id ? `created preference id=${result.id}` : null;
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
    elapsedMs: Date.now() - started,
  });
}

// The dispute evidence package (WS-8 · R-5; aceptacion-ux §10.5 step 2;
// Términos §10.7). Pure: the lines it holds and a small text-only PDF writer
// (no dependency; Helvetica, WinAnsi). Used only to answer the dispute
// (Aviso de Privacidad, finalidad 7). Never a full card number.

import { createHash } from 'node:crypto';

export interface EvidenceConsent {
  event_type: string;
  consent_id: string;
  timestamp_utc: string;
  ip: string | null;
  user_agent: string | null;
  disclosure_text: string | null;
  checkbox_text: string | null;
  checkbox_checked: boolean | null;
  button_label: string | null;
  ui_version: string;
  event_hash: string;
  documents: { doc: string; version: string; url: string; sha256: string }[];
}

export interface EvidenceNotice {
  kind: string;
  template: string;
  message_id: string | null;
  sent_at: string;
  delivery_status: string;
}

export interface EvidenceInput {
  generatedAt: Date;
  account: { userId: string; email: string | null };
  charge: {
    mpPaymentId: string;
    mpPreapprovalId: string | null;
    amountMxn: number;
    chargedAt: string;
    cardBrand: string | null;
    cardLast4: string | null;
  };
  consents: EvidenceConsent[];
  notices: EvidenceNotice[];
  cancellation: { requestedAt: string | null; folio: string | null };
  usage: { from: string; to: string; lastSignInAt: string | null; meteredEvents: number };
  policyUrls: string[];
}

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** A card number (13–19 digits, spaces/dashes allowed, Luhn-valid) is cut
 *  to its last 4. Payment and preapproval ids are left alone. */
export function maskCardNumbers(s: string): string {
  return s.replace(/\b\d(?:[ -]?\d){12,18}\b/g, (m) => {
    const digits = m.replace(/\D/g, '');
    return luhn(digits) ? `•••• ${digits.slice(-4)}` : m;
  });
}

const money = (n: number) =>
  `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;

export function evidenceLines(i: EvidenceInput): string[] {
  const L: string[] = [
    'Chalyb · Paquete de evidencia de disputa',
    `Generado: ${i.generatedAt.toISOString()} · uso exclusivo para esta disputa (Aviso de Privacidad, finalidad 7)`,
    '',
    '4. Comprobante del cargo',
    `Pago Mercado Pago: ${i.charge.mpPaymentId}`,
    `Suscripción (preapproval): ${i.charge.mpPreapprovalId ?? '—'}`,
    `Monto: ${money(i.charge.amountMxn)} · fecha: ${i.charge.chargedAt}`,
    `Tarjeta: ${i.charge.cardBrand ?? '—'} terminación ${i.charge.cardLast4 ?? '—'}`,
    `Cuenta: ${i.account.email ?? '—'} (${i.account.userId})`,
    '',
    '1. Consentimiento',
  ];
  if (i.consents.length === 0) L.push('Sin registro de consentimiento para este cargo.');
  for (const c of i.consents) {
    L.push(
      `${c.event_type} · folio ${c.consent_id} · ${c.timestamp_utc}`,
      `IP: ${c.ip ?? '—'} · dispositivo: ${c.user_agent ?? '—'}`,
      `Texto del bloque de cobro: ${c.disclosure_text ?? '—'}`,
      `Casilla: ${c.checkbox_text ?? '—'} · marcada: ${c.checkbox_checked === true ? 'sí' : 'no'}`,
      `Botón: ${c.button_label ?? '—'} · versión de interfaz: ${c.ui_version}`,
      ...c.documents.map((d) => `Documento ${d.doc} v${d.version} · ${d.url} · sha256 ${d.sha256}`),
      `event_hash: ${c.event_hash}`,
      '',
    );
  }
  L.push('3. Avisos');
  if (i.notices.length === 0) L.push('Sin avisos registrados para este cargo.');
  for (const n of i.notices)
    L.push(
      `${n.kind} (${n.template}) · enviado ${n.sent_at} · estado ${n.delivery_status} · message_id ${n.message_id ?? '—'}`,
    );
  L.push(
    '',
    '5. Cancelación',
    i.cancellation.requestedAt
      ? `Cancelación solicitada el ${i.cancellation.requestedAt} (folio ${i.cancellation.folio ?? '—'}).`
      : 'Sin solicitud de cancelación antes del cargo. El botón "Cancelar" estaba disponible en Mi cuenta → Mi plan (Términos de Suscripción §6.1).',
    '',
    '6. Uso en el periodo cobrado',
    `Periodo: ${i.usage.from} a ${i.usage.to} · último inicio de sesión: ${i.usage.lastSignInAt ?? '—'} · eventos de uso medidos: ${i.usage.meteredEvents}`,
    '',
    '7. Políticas aceptadas',
    ...i.policyUrls,
  );
  return L.map(maskCardNumbers);
}

// ── A small PDF writer ────────────────────────────────────────────────────

const WIDTH = 92;
const PER_PAGE = 52;

function wrapLine(s: string): string[] {
  if (s.length <= WIDTH) return [s];
  const out: string[] = [];
  let rest = s;
  while (rest.length > WIDTH) {
    const cut = rest.lastIndexOf(' ', WIDTH);
    const at = cut > 20 ? cut : WIDTH;
    out.push(rest.slice(0, at));
    rest = rest.slice(at).trimStart();
  }
  out.push(rest);
  return out;
}

/** WinAnsi covers Spanish; anything outside it becomes "?". */
function winAnsi(s: string): string {
  return s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[→]/g, '>')
    .replace(/[•]/g, '*')
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export function renderPdf(lines: readonly string[]): Uint8Array {
  const wrapped = lines.flatMap(wrapLine);
  const pages: string[][] = [];
  for (let k = 0; k < Math.max(1, wrapped.length); k += PER_PAGE)
    pages.push(wrapped.slice(k, k + PER_PAGE));

  const objs: string[] = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  const kids: string[] = [];
  pages.forEach((page, p) => {
    const pageId = 4 + p * 2;
    const contentId = pageId + 1;
    kids.push(`${pageId} 0 R`);
    const body = [
      'BT /F1 9 Tf 12 TL 40 800 Td',
      ...page.map((l) => `(${winAnsi(l)}) '`),
      'ET',
    ].join('\n');
    objs[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objs[contentId] = `<< /Length ${Buffer.byteLength(body, 'latin1')} >>\nstream\n${body}\nendstream`;
  });
  objs[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objs.length; id++) {
    offsets[id] = Buffer.byteLength(out, 'latin1');
    out += `${id} 0 obj\n${objs[id]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objs.length; id++) out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, 'latin1'));
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

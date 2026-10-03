// What a Mercado Pago notification is about — pure, no I/O.
//
// Mercado Pago calls /api/mp/webhook in two shapes (B35):
//   Webhooks  POST JSON `{ type, action, data: { id } }`, sometimes with the
//             same pointer in the query string (`?data.id=…&type=…`). Signed
//             with x-signature.
//   IPN       the legacy format: `?id=…&topic=…` with an empty body, a form
//             body, or JSON `{ resource, topic }`. `merchant_order` only ever
//             arrives this way (the one real approved payment so far,
//             Operación 182026865254, is a checkout_merchant_order). Usually
//             unsigned.
// The query string is read BEFORE the body, and an empty body is not an
// error. Either way the notification is only a pointer: the route fetches
// the resource from Mercado Pago with our token before acting on it.

export type MpTopic =
  | 'payment'
  | 'merchant_order'
  | 'subscription_preapproval'
  | 'subscription_authorized_payment'
  | 'orders';

export interface MpNotification {
  format: 'webhook' | 'ipn';
  /** Normalised topic, or the raw one when we don't handle it. */
  topic: MpTopic | string;
  handled: boolean;
  /** The resource id, as Mercado Pago sent it. null = nothing to fetch. */
  dataId: string | null;
}

const ALIASES: Readonly<Record<string, MpTopic>> = {
  payment: 'payment',
  merchant_order: 'merchant_order',
  subscription_preapproval: 'subscription_preapproval',
  preapproval: 'subscription_preapproval',
  subscription_authorized_payment: 'subscription_authorized_payment',
  authorized_payment: 'subscription_authorized_payment',
  orders: 'orders',
  order: 'orders',
};

const HANDLED: ReadonlySet<string> = new Set<MpTopic>([
  'payment',
  'merchant_order',
  'subscription_preapproval',
  'subscription_authorized_payment',
  'orders',
]);

/** The topic we handle under this name, or the name itself. */
function normaliseTopic(name: string): string {
  return (Object.hasOwn(ALIASES, name) ? ALIASES[name] : undefined) ?? name;
}

function clean(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

/** The id at the end of an IPN `resource` URL (…/merchant_orders/123). */
function idFromResource(resource: unknown): string | null {
  const r = clean(resource);
  if (!r) return null;
  const m = /\/([A-Za-z0-9_-]+)\/?$/.exec(r);
  return m?.[1] ?? (/^[A-Za-z0-9_-]+$/.test(r) ? r : null);
}

function parseBody(text: string, contentType: string | null): Record<string, unknown> {
  const raw = text.trim();
  if (!raw) return {};
  if (contentType?.includes('application/x-www-form-urlencoded') || !/^[[{]/.test(raw)) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Read a notification from its URL, body and content type. Never throws:
 * junk comes back as an unhandled notification with no id (the route answers
 * 200 so Mercado Pago stops retrying something it will never get right).
 */
export function parseMpNotification(
  url: string,
  bodyText: string,
  contentType: string | null,
): MpNotification {
  let q: URLSearchParams;
  try {
    q = new URL(url, 'https://placeholder.invalid').searchParams;
  } catch {
    q = new URLSearchParams();
  }
  const body = parseBody(bodyText, contentType);
  const data = (body.data && typeof body.data === 'object' ? body.data : {}) as { id?: unknown };

  // IPN: `topic` (query or body) is what marks it.
  const ipnTopic = clean(q.get('topic')) ?? clean(body.topic);
  const webhookType = clean(q.get('type')) ?? clean(body.type);

  if (ipnTopic && !webhookType) {
    const topic = normaliseTopic(ipnTopic);
    const dataId = clean(q.get('id')) ?? clean(body.id) ?? idFromResource(body.resource);
    return { format: 'ipn', topic, handled: HANDLED.has(topic), dataId };
  }

  const rawType = webhookType ?? '';
  const topic = normaliseTopic(rawType);
  const dataId = clean(data.id) ?? clean(q.get('data.id')) ?? clean(q.get('id'));
  return { format: 'webhook', topic, handled: HANDLED.has(topic), dataId };
}

/**
 * Whether an unsigned notification may proceed. A Webhooks-format call is
 * always signed by Mercado Pago, so an unsigned one is refused. An IPN call
 * usually isn't signed; it is let through because the route only ever acts
 * on the resource it fetches from Mercado Pago with our own token, never on
 * anything in the request.
 */
export function unsignedAllowed(n: MpNotification): boolean {
  return n.format === 'ipn';
}

/** The payment ids inside a merchant order, for the IPN `merchant_order`
 *  topic: each one is settled through the `payment` path. */
export function merchantOrderPaymentIds(order: unknown): string[] {
  const payments = (order as { payments?: unknown } | null)?.payments;
  if (!Array.isArray(payments)) return [];
  const ids = payments.map((p) => clean((p as { id?: unknown })?.id)).filter(Boolean) as string[];
  return [...new Set(ids)];
}

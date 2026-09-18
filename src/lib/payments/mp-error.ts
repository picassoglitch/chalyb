// Reading what Mercado Pago actually said when a call failed.
//
// The SDK does not throw an Error. Its REST client ends a failed request with
// `throw await response.json()`, so what lands in a catch block is the parsed
// JSON error body, and every API shapes that body differently:
//
//   /preapproval   { message, error, status, cause: [{ code, description }] }
//   /v1/payments   { message, error, status, cause: [{ code, description }] }
//   /v1/orders     { errors: [{ code, message, details: [...] }] }
//   gateway 4xx    { error, message, status }  or an empty body
//
// The old reader looked only at `message` and a `cause` OBJECT, so an Orders
// API failure — whose text lives in `errors[].message` and nowhere else —
// came back as "sin detalle" and the operator was left with a dead end.
// This one walks whichever of those keys are present and reports all of it.
//
// No imports on purpose: the error shapes are plain data, so this stays
// unit-testable without pulling in the SDK.

/** How deep to walk nested error bodies before giving up. */
const MAX_DEPTH = 4;

/** Keys whose value is human-readable text. */
const TEXT_KEYS = ['message', 'description', 'detail', 'title', 'reason'] as const;
/** Keys whose value is another error, or a list of them. */
const NESTED_KEYS = ['errors', 'cause', 'error', 'details', 'causes'] as const;

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asCode(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return asText(value);
}

/**
 * Collect every human-readable line in an error body, keyed by the text so
 * the same sentence reported under two keys (a top-level `message` and the
 * `cause` entry that repeats it) is one line, carrying whichever code the
 * deeper entry supplied.
 */
function collect(node: unknown, out: Map<string, string | null>, depth = 0): void {
  if (depth > MAX_DEPTH || node == null) return;

  const direct = asText(node);
  if (direct) {
    if (!out.has(direct)) out.set(direct, null);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collect(item, out, depth + 1);
    return;
  }
  if (typeof node !== 'object') return;

  const o = node as Record<string, unknown>;
  const text = TEXT_KEYS.map((k) => asText(o[k])).find((v): v is string => v !== null) ?? null;
  const code = asCode(o.code);
  if (text) {
    // Keep the first sighting's position, but take a code from any of them.
    if (!out.has(text) || (out.get(text) === null && code)) out.set(text, code);
  } else if (code && !out.has(code)) {
    out.set(code, null);
  }

  for (const key of NESTED_KEYS) {
    if (key in o) collect(o[key], out, depth + 1);
  }
}

/** "the sentence (THE_CODE)", or just the sentence when there is no code. */
function render(lines: Map<string, string | null>): string {
  return Array.from(lines, ([text, code]) =>
    code && !text.includes(code) ? `${text} (${code})` : text,
  ).join(' · ');
}

/**
 * One line naming what Mercado Pago refused and why, for a message the
 * operator or the buyer can act on. Includes the HTTP status when the body
 * carries one, because "400" and "401" mean very different things to whoever
 * is debugging a checkout.
 */
export function describeMpError(err: unknown): string {
  const direct = asText(err);
  if (direct) return direct;

  const o = (err ?? {}) as Record<string, unknown>;
  const lines = new Map<string, string | null>();
  collect(o, lines);

  const status =
    typeof o.status === 'number'
      ? o.status
      : typeof o.status_code === 'number'
        ? o.status_code
        : null;

  const joined = render(lines);

  // An empty body is what the gateway returns when it rejects the
  // credential itself, and node-fetch turns that into this parse error.
  if (o.type === 'invalid-json' || /invalid json response body/i.test(joined)) {
    return (
      'Mercado Pago respondió sin cuerpo, que es lo que hace cuando rechaza la credencial. ' +
      'Revisa que MERCADOPAGO_ACCESS_TOKEN en Vercel sea el Access Token vigente (si lo ' +
      'regeneraste en el panel, el anterior dejó de servir) y sin espacios ni comillas. ' +
      '/api/diag/mp muestra el código HTTP real.'
    );
  }

  if (!joined) {
    return status
      ? `HTTP ${status}, sin detalle en la respuesta`
      : 'sin detalle (revisa los logs del servidor)';
  }
  return status ? `HTTP ${status} · ${joined}` : joined;
}

/**
 * The whole error body as one string for the server log. `console.error`
 * with an object gives "[object Object]" in some log viewers, and the body
 * is the only record of what Mercado Pago objected to.
 */
export function mpErrorForLog(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}\n${err.stack ?? ''}`;
  try {
    return JSON.stringify(err, null, 2) ?? String(err);
  } catch {
    return String(err);
  }
}

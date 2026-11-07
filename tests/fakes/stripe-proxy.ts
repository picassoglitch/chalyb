// The real Stripe SDK against the official stripe-mock: every request is validated by
// stripe-mock's OpenAPI spec, then a test may patch the (stateless) answer into a scenario.

import { createServer, request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import Stripe from 'stripe';

export const STRIPE_MOCK_URL = process.env.STRIPE_MOCK_URL ?? 'http://127.0.0.1:12111';

export interface SeenRequest {
  method: string;
  path: string;
  /** The form body, flattened as Stripe sends it: `items[0][price]`, `metadata[x]`… */
  form: Record<string, string>;
  status: number;
  idempotencyKey: string | null;
}

type Json = Record<string, unknown>;
export type Patch = (body: Json, req: SeenRequest) => Json;

export interface StripeProxy {
  client: Stripe;
  seen: SeenRequest[];
  /** Patches applied to stripe-mock's answer, first match per request (method + path regex). */
  patches: { method: string; path: RegExp; patch: Patch }[];
  on(method: string, path: RegExp, patch: Patch): void;
  calls(method: string, path: RegExp): SeenRequest[];
  reset(): void;
  close(): Promise<void>;
}

export async function stripeMockUp(): Promise<boolean> {
  try {
    const res = await new Promise<number>((resolve, reject) => {
      const r = request(`${STRIPE_MOCK_URL}/v1/customers/cus_ping`, {
        headers: { authorization: 'Bearer sk_test_123' },
      });
      r.on('response', (m) => {
        m.resume();
        resolve(m.statusCode ?? 0);
      });
      r.on('error', reject);
      r.end();
    });
    return res === 200;
  } catch {
    return false;
  }
}

export async function startStripeProxy(): Promise<StripeProxy> {
  const upstream = new URL(STRIPE_MOCK_URL);
  const proxy: Omit<StripeProxy, 'client' | 'close'> = {
    seen: [],
    patches: [],
    on(method, path, patch) {
      this.patches.push({ method, path, patch });
    },
    calls(method, path) {
      return this.seen.filter((s) => s.method === method && path.test(s.path));
    },
    reset() {
      this.seen = [];
      this.patches = [];
    },
  };
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const url = new URL(req.url ?? '/', 'http://x');
      const raw = req.method === 'GET' ? url.search.slice(1) : body.toString('utf8');
      const form = Object.fromEntries(new URLSearchParams(raw));
      const up = request(
        {
          host: upstream.hostname,
          port: upstream.port,
          path: req.url,
          method: req.method,
          headers: { ...req.headers, host: upstream.host },
        },
        (m) => {
          const out: Buffer[] = [];
          m.on('data', (c: Buffer) => out.push(c));
          m.on('end', () => {
            const seen: SeenRequest = {
              method: req.method ?? 'GET',
              path: url.pathname,
              form,
              status: m.statusCode ?? 0,
              idempotencyKey: (req.headers['idempotency-key'] as string | undefined) ?? null,
            };
            proxy.seen.push(seen);
            let text = Buffer.concat(out).toString('utf8');
            const hit = proxy.patches.find(
              (p) => p.method === seen.method && p.path.test(seen.path),
            );
            let status = m.statusCode ?? 500;
            if (hit && seen.status < 400) {
              const out = hit.patch(JSON.parse(text), seen);
              // A patch may answer as Stripe failing (`__status`), e.g. a 500 after the charge.
              if (typeof out.__status === 'number') status = out.__status;
              text = JSON.stringify(out);
            }
            res.writeHead(status, {
              'content-type': 'application/json',
              'request-id': 'req_proxy',
            });
            res.end(text);
          });
        },
      );
      up.on('error', (err) => {
        res.writeHead(502);
        res.end(JSON.stringify({ error: { message: String(err) } }));
      });
      up.end(body);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const client = new Stripe('sk_test_123', {
    host: '127.0.0.1',
    port,
    protocol: 'http',
    maxNetworkRetries: 0,
  });
  return Object.assign(proxy, {
    client,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }) as StripeProxy;
}

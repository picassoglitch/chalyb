// QA 2026-11-06: a Free account with 50,000 credits was refused a Clips
// upload with a bare "no tienes créditos". The engine now sends what the
// video needs and what the person has; this follows those two numbers from
// the engine's error body to the sentence on screen.

import test from 'node:test';
import assert from 'node:assert/strict';
import { clipsEngine, type ClipsEngineDeps } from '@/lib/tools/adapters/clips/client';
import { engineErrorFrom } from '@/lib/tools/adapters/clips/errors';
import { creditsOf, failureEffect, normalizeToolError } from '@/lib/tools/bff-core';
import {
  errorText,
  toolCall,
  ToolCallError,
  type ErrorCopy,
} from '@/components/tools/clips/engine/tool-call';

const COPY = {
  generic: 'G',
  code: 'Código {codigo}.',
  session: 'S',
  no_credits: 'No tienes créditos suficientes.',
  no_credits_amounts: 'Este video necesita unos {necesita} créditos y tienes {tienes}.',
  rate_limited: 'R',
  too_large: 'T',
  needs_plan: 'N',
  not_found: 'NF',
  bad_request: 'B',
  forbidden: 'F',
  timeout: 'TO',
} satisfies ErrorCopy;

// What ChalyClip answers for a Free upload of unknown length (hub_api.py).
const REFUSAL = {
  ok: false,
  error: {
    code: 'no_credits',
    message: 'No tienes tokens suficientes para procesar este video.',
    reason: 'no_tokens',
    retryable: false,
    credits: { needed: 82_821, remaining: 50_000 },
  },
};

function engineAnswering(status: number, body: unknown) {
  const deps: ClipsEngineDeps = {
    fetch: (async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch,
    identity: async () => ({
      userId: 'u1',
      email: 'free@example.com',
      tenantId: 'ten_1',
      tier: 'free',
      baseUrl: 'https://clips.example',
    }),
    mint: () => 'tok',
    forget: () => {},
  };
  return clipsEngine('u1', deps);
}

test('engine no_tokens refusal keeps its credit figures through the BFF', async () => {
  const err = await engineAnswering(402, REFUSAL)
    .post('/uploads', {})
    .catch((e: unknown) => e);
  const effect = failureEffect(err, { adapterErrorsOnly: true });
  assert.equal(effect.reason, 'no_credits');
  assert.equal(effect.outage, false);
  assert.deepEqual(effect.credits, { needed: 82_821, remaining: 50_000 });
});

test('credit figures are only whole, non-negative numbers on a no_credits error', () => {
  for (const bad of [
    { needed: -1, remaining: 5 },
    { needed: 1.5, remaining: 5 },
    { needed: '10', remaining: 5 },
    { needed: 10 },
    null,
    'x',
  ]) {
    const e = engineErrorFrom(402, { error: { ...REFUSAL.error, credits: bad } });
    assert.equal(e.credits, null, JSON.stringify(bad));
    assert.equal(normalizeToolError(e).credits, undefined);
  }
  // Another refusal never carries them, even if a body sent some.
  const capped = engineErrorFrom(429, {
    error: { code: 'rate_limited', reason: 'minutes_cap', credits: { needed: 1, remaining: 0 } },
  });
  assert.equal(normalizeToolError(capped).credits, undefined);
  assert.equal(creditsOf({ credits: { needed: 0, remaining: 0 } })?.needed, 0);
});

test('the screen says how many credits the video needs and how many there are', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        ok: false,
        error: {
          reason: 'no_credits',
          supportCode: 'CLP-0427',
          credits: { needed: 82_821, remaining: 50_000 },
        },
      }),
      { status: 402 },
    )) as typeof fetch;
  try {
    const err = await toolCall('/uploads', 'POST', {}).catch((e: unknown) => e);
    assert.ok(err instanceof ToolCallError);
    assert.equal(
      errorText(err, COPY),
      'Este video necesita unos 82,821 créditos y tienes 50,000. Código CLP-0427.',
    );
  } finally {
    globalThis.fetch = realFetch;
  }
  // No figures (an older engine) → the plain sentence, as before.
  assert.equal(
    errorText(new ToolCallError('no_credits', null, null), COPY),
    'No tienes créditos suficientes.',
  );
});

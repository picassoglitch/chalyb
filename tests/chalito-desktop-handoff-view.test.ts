import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as nodeModule from 'node:module';
import type { LoadFnOutput, LoadHookContext } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import swc from 'next/dist/build/swc/index.js';
import es from '../src/lib/chalito/messages/es.json' with { type: 'json' };
import en from '../src/lib/chalito/messages/en.json' with { type: 'json' };
import type { DesktopHandoffResult } from '@/lib/chalito/web/desktop-sso';

// Node strips TypeScript but not JSX: compile .tsx with the SWC that ships with Next, for this test only.
await swc.loadBindings();
// registerHooks is Node 22.15+; @types/node here predates it (tests/ts-resolve.mjs uses it too).
const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: {
    load: (
      url: string,
      context: LoadHookContext,
      nextLoad: (url: string, context?: Partial<LoadHookContext>) => LoadFnOutput,
    ) => LoadFnOutput;
  }) => void;
};
registerHooks({
  load(
    url: string,
    context: LoadHookContext,
    nextLoad: (url: string, context?: Partial<LoadHookContext>) => LoadFnOutput,
  ): LoadFnOutput {
    if (!url.endsWith('.tsx')) return nextLoad(url, context);
    const filename = fileURLToPath(url);
    const { code } = swc.transformSync(readFileSync(filename, 'utf8'), {
      filename,
      jsc: {
        parser: { syntax: 'typescript', tsx: true },
        transform: { react: { runtime: 'automatic' } },
        target: 'es2022',
      },
      module: { type: 'es6' },
    });
    return { format: 'module', source: code, shortCircuit: true };
  },
});
const { DesktopHandoffView } = await import('@/components/tools/chalito/DesktopHandoff');

type IntlProps = ComponentProps<typeof NextIntlClientProvider>;
const render = (result: DesktopHandoffResult | null, locale: 'es' | 'en' = 'es') => {
  const intl = {
    locale,
    timeZone: 'America/Mexico_City',
    messages: { chalito: locale === 'es' ? es : en },
    onError: (e: Error & { code?: string }) => {
      if (e.code === 'MISSING_MESSAGE') throw e;
    },
  } as Omit<IntlProps, 'children'> as IntlProps;
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, intl, createElement(DesktopHandoffView, { result })),
  );
};

const URL_OK = `chalito://auth/sso?token=tok-1&state=${'A'.repeat(43)}`;

test('DesktopHandoff: working, then the "Abrir Chalito" link to the app (no referrer)', () => {
  assert.match(render(null), /aria-busy="true"[^>]*>Entrando a Chalito…/);
  const html = render({ ok: true, url: URL_OK });
  assert.match(html, /data-testid="desktop-handoff"/);
  assert.match(html, />Abrir Chalito</);
  assert.match(html, new RegExp(`href="${URL_OK.replace('?', '\\?').replace(/&/g, '&amp;')}"`));
  assert.match(html, /rel="noreferrer"/);
});

test('DesktopHandoff: signed out, no access, rate limited and failed each say something different', () => {
  const copy = new Map<string, string>();
  for (const locale of ['es', 'en'] as const)
    for (const reason of ['signed_out', 'no_access', 'rate_limited', 'failed'] as const) {
      const html = render({ ok: false, reason }, locale);
      assert.match(html, new RegExp(`role="alert"[^>]*data-reason="${reason}"`));
      assert.doesNotMatch(html, /chalito\.sso|MISSING_MESSAGE/);
      copy.set(`${locale}:${reason}`, html.replace(/<[^>]+>/g, ''));
    }
  assert.equal(new Set(copy.values()).size, copy.size);
  assert.match(copy.get('es:signed_out')!, /sesión de Chalyb se cerró/);
  assert.match(copy.get('es:no_access')!, /no tiene acceso a Chalito/);
  assert.match(copy.get('en:no_access')!, /doesn(?:'|&#x27;)t have access to Chalito/);
});

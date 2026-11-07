// The header logo is served as a plain static file, never through /_next/image:
// an aborted optimizer request left that URL hung for every later page (e2e networkidle).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as nodeModule from 'node:module';
import type { LoadFnOutput, LoadHookContext } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import swc from 'next/dist/build/swc/index.js';

// Node strips TypeScript but not JSX: compile .tsx with the SWC that ships with Next, for this test only.
await swc.loadBindings();
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
  load(url, context, nextLoad) {
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
    // next/image is CommonJS: under Node ESM its default import is the module object.
    const source = code.replace(
      /import (\w+) from ["']next\/image["'];/,
      "import $1__cjs from 'next/image'; const $1 = $1__cjs.default ?? $1__cjs;",
    );
    return { format: 'module', source, shortCircuit: true };
  },
});

const { BrandMark } = await import('@/components/landing/brand-mark');
const { FusionMark } = await import('@/components/dashboard/fusion-mark');

for (const [name, el] of [
  ['BrandMark', createElement(BrandMark)],
  ['FusionMark', createElement(FusionMark)],
] as const) {
  test(`${name} points straight at /chalyb-mark.png, not /_next/image`, () => {
    const html = renderToStaticMarkup(el);
    assert.match(html, /src="\/chalyb-mark\.png"/, html);
    assert.doesNotMatch(html, /_next\/image/, html);
  });
}

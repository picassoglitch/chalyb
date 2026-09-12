// Module resolution shim for `node --test`.
//
// The app is written for a bundler: imports are extensionless (`./pricing`)
// and use the `@/` alias from tsconfig. Node's ESM resolver understands
// neither, so these few lines teach it both — that's the whole reason this
// file exists, and why the tests can run against src/ with no build step and
// no test-runner dependency.
//
// Node strips the TypeScript types itself (--experimental-strip-types, Node
// 22.6+). Nothing here type-checks: `pnpm build` does that.

import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = new URL('../src/', import.meta.url);
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.js', '/index.ts', '/index.tsx'];

/** Try each extension against the filesystem; return the first that exists. */
function resolveWithExtension(url) {
  if (existsSync(fileURLToPath(url))) return url;
  for (const ext of EXTENSIONS) {
    const candidate = new URL(url.href + ext);
    if (existsSync(fileURLToPath(candidate))) return candidate;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isAlias = specifier.startsWith('@/');
    const isRelative = specifier.startsWith('./') || specifier.startsWith('../');

    if (isAlias || isRelative) {
      const base = isAlias ? new URL(specifier.slice(2), SRC) : new URL(specifier, context.parentURL);
      const resolved = resolveWithExtension(base);
      if (resolved) return { url: resolved.href, shortCircuit: true };
    }

    // `server-only` is a Next.js build-time marker with no runtime behaviour
    // worth pulling into a unit test.
    if (specifier === 'server-only') {
      return { url: new URL('./stubs/server-only.mjs', import.meta.url).href, shortCircuit: true };
    }

    return nextResolve(specifier, context);
  },
});

import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // WS-11 (TOOLS-SPEC §0.1, F3): nothing inside the app opens a tab or a
  // window. Downloads use the same tab (Content-Disposition: attachment) and
  // OAuth redirects come back to the same tab, so neither needs one. Add a
  // file to `ignores` only for a download that truly can't be same-tab.
  {
    files: [
      'src/app/**/(dashboard)/app/**/*.{ts,tsx}',
      'src/components/{app,tools,workspace}/**/*.{ts,tsx}',
    ],
    ignores: [],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='window'][callee.property.name='open']",
          message: 'No window.open in the app (TOOLS-SPEC §0.1): tools open in the same tab.',
        },
        {
          selector: "CallExpression[callee.type='Identifier'][callee.name='open']",
          message: 'No window.open in the app (TOOLS-SPEC §0.1): tools open in the same tab.',
        },
        {
          selector: "JSXAttribute[name.name='target'][value.value='_blank']",
          message: 'No target="_blank" in the app (TOOLS-SPEC §0.1): use the same tab or a Sheet.',
        },
      ],
    },
  },
  {
    // Chalito's browser code and screens, copied unchanged from picassoglitch/chalito (reviewed
    // there); its effects and memos predate these React Compiler rules. Don't widen this to hub code.
    files: ['src/lib/chalito/**/*.{ts,tsx}', 'src/components/tools/chalito/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', '.claude/**']),
]);

export default eslintConfig;

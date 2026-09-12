import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vite resolves the `@/…` alias from tsconfig.json natively now, so tests
  // import modules by the same specifier the app uses and no path plugin is
  // needed.
  resolve: { tsconfigPaths: true },
  test: {
    // `node`, not `jsdom`: everything under test here is server-side rule code
    // — permission gates, signature verification, date arithmetic — and none
    // of it touches the DOM. Add a jsdom environment per-file, with a
    // `// @vitest-environment jsdom` comment, if a component test ever lands.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});

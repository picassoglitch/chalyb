// Every web font, from files in this folder. The build used to download them
// from Google Fonts, and that download kept failing CI. Licenses: LICENSES.md.

import localFont from 'next/font/local';

// Body font on every page. Not preloaded: it competed with the hero's LCP
// image, and the metric-adjusted fallback keeps CLS at 0 (LANDING-SPEC §7).
export const interPublic = localFont({
  src: './inter-latin-wght.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  variable: '--cc-body',
});

// The same face for the signed-in app and the owner panel, preloaded there.
export const interApp = localFont({
  src: './inter-latin-wght.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--cc-body',
});

export const spaceGrotesk = localFont({
  src: './space-grotesk-latin-wght.woff2',
  weight: '300 700',
  display: 'swap',
  variable: '--cc-disp',
});

export const jetbrainsMono = localFont({
  src: './jetbrains-mono-latin-wght.woff2',
  weight: '100 800',
  display: 'swap',
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'monospace'],
  variable: '--cc-mono',
});

// Legacy faces (globals.css) for pages not yet rebuilt. Not preloaded, so a
// page that never uses them never downloads them.
export const legacyDisplay = localFont({
  src: [
    { path: './familjen-grotesk-latin-wght.woff2', weight: '400 700', style: 'normal' },
    { path: './familjen-grotesk-latin-wght-italic.woff2', weight: '400 700', style: 'italic' },
  ],
  display: 'swap',
  preload: false,
  variable: '--font-familjen',
});

export const legacySerif = localFont({
  src: './fraunces-latin-opsz.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
  fallback: ['Georgia', 'serif'],
  variable: '--font-fraunces',
});

export const legacyMono = localFont({
  src: [
    { path: './space-mono-latin-400.woff2', weight: '400', style: 'normal' },
    { path: './space-mono-latin-700.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'monospace'],
  variable: '--font-space-mono',
});

'use client';

// Shared shell for /terms and /privacy. Renders the marketing nav + footer
// around the document content, so legal pages have the same visual identity
// as the public landing. Uses the existing PathProvider so the path-color
// engine + cursor + grain effects work consistently.
//
// Server pages pass `title`, `lastUpdated`, and the document body as
// children. The body uses `.legal-prose` markup defined in globals.css.

import { Suspense, useEffect, useState } from 'react';
import { PathProvider } from '@/components/landing/use-path';
import { Cursor } from '@/components/landing/cursor';
import { ProgressBar } from '@/components/landing/progress-bar';
import { LandingNav } from '@/components/landing/nav';
import { LandingFooter } from '@/components/landing/footer';

interface Props {
  title: string;
  lastUpdated: string;
  isAuthenticated: boolean;
  children: React.ReactNode;
}

function LegalInner({ title, lastUpdated, isAuthenticated, children }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <>
      {mounted && (
        <>
          <Cursor />
          <div className="grain" />
          <ProgressBar />
        </>
      )}
      <LandingNav isAuthenticated={isAuthenticated} />

      <main
        style={{
          minHeight: '100vh',
          padding: 'clamp(100px, 14vh, 160px) 24px 80px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            maxWidth: 760,
            margin: '0 auto',
          }}
        >
          <div style={{ marginBottom: 36 }}>
            <p
              style={{
                fontFamily: 'var(--font-mono), monospace',
                fontSize: 11,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--path)',
                marginBottom: 12,
              }}
            >
              · Legal ·
            </p>
            <h1
              style={{
                fontFamily: 'var(--font-display), sans-serif',
                fontSize: 'clamp(32px, 5vw, 52px)',
                fontWeight: 700,
                letterSpacing: '-0.025em',
                lineHeight: 1.05,
                marginBottom: 16,
                color: 'var(--ink)',
              }}
            >
              {title}
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-mono), monospace',
                fontSize: 12,
                color: 'var(--ink-faint)',
                letterSpacing: '0.04em',
              }}
            >
              Última actualización · {lastUpdated}
            </p>
          </div>

          {/* The `legal-prose` class gives consistent typography for h2, h3,
              p, ul, code, strong inside legal documents. Defined in globals.css. */}
          <div className="legal-prose">{children}</div>
        </div>
      </main>

      <LandingFooter />
    </>
  );
}

export function LegalPage(props: Props) {
  return (
    <Suspense fallback={null}>
      <PathProvider>
        <LegalInner {...props} />
      </PathProvider>
    </Suspense>
  );
}

'use client';

import { Suspense, useEffect, useState } from 'react';
import { PathProvider } from '@/components/landing/use-path';
import { Cursor } from '@/components/landing/cursor';
import { ProgressBar } from '@/components/landing/progress-bar';
import { LandingNav } from '@/components/landing/nav';
import { LandingFooter } from '@/components/landing/footer';
import { ContactForm } from './contact-form';

function ContactInner({ isAuthenticated }: { isAuthenticated: boolean }) {
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
            maxWidth: 720,
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
              · Contacto ·
            </p>
            <h1
              style={{
                fontFamily: 'var(--font-display), sans-serif',
                fontSize: 'clamp(36px, 6vw, 64px)',
                fontWeight: 700,
                letterSpacing: '-0.025em',
                lineHeight: 1.05,
                marginBottom: 16,
                color: 'var(--ink)',
              }}
            >
              Hablemos.
            </h1>
            <p
              style={{
                fontSize: 'clamp(15px, 2vw, 17px)',
                color: 'var(--ink-dim)',
                lineHeight: 1.55,
                maxWidth: '56ch',
              }}
            >
              ¿Quieres una demo, integrar algo, sumarte como partner o saber cómo Chalyb puede
              poner orden en tu operación? Escríbenos y te respondemos en menos de 24 horas hábiles.
            </p>
          </div>

          <div
            style={{
              padding: 'clamp(20px, 3vw, 32px)',
              border: '1px solid var(--line-bright)',
              borderRadius: 16,
              background: 'rgba(16, 19, 32, 0.55)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            <ContactForm />
          </div>

          <div
            style={{
              marginTop: 28,
              display: 'flex',
              gap: 18,
              flexWrap: 'wrap',
              fontSize: 12.5,
              color: 'var(--ink-faint)',
              fontFamily: 'var(--font-mono), monospace',
            }}
          >
            <span>· Te respondemos en menos de 24h hábiles</span>
            <span>· Tu correo no se publica</span>
            <span>· No te metemos a ningún newsletter</span>
          </div>
        </div>
      </main>

      <LandingFooter />
    </>
  );
}

export function ContactPage({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <Suspense fallback={null}>
      <PathProvider>
        <ContactInner isAuthenticated={isAuthenticated} />
      </PathProvider>
    </Suspense>
  );
}

'use client';

// Error boundary for the entire /app/* subtree.
//
// Whenever any server component below /app throws — Supabase down, a
// missing migration column, a typo in a downstream lib, ANY exception
// during SSR/RSC — Next.js renders THIS component instead of Vercel's
// generic "page couldn't load" screen. The user gets:
//
//   - A clear "algo se rompió en esta pantalla" message in our brand
//   - The Next.js error.digest (short hash) so they can paste it back
//     and the operator can grep Vercel logs to find the exact failure
//   - A "Recargar" button + a "Volver al inicio" escape hatch
//
// In dev (NODE_ENV !== 'production') we also render the raw error.message
// inline — leaks nothing in production builds where Next.js scrubs the
// message string to its digest.
//
// `error.tsx` files have a specific shape required by Next.js:
//   - 'use client' directive
//   - takes { error, reset } props
//   - the error has an optional .digest set by the framework
//
// Reference: https://nextjs.org/docs/app/building-your-application/routing/error-handling

import type { Route } from 'next';
import { Link } from '@/i18n/routing';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDev = process.env.NODE_ENV !== 'production';
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
        gap: 18,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: 'rgba(255, 93, 93, 0.08)',
          border: '1px solid var(--cc-red, #ff5d5d)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
        }}
      >
        ⚠
      </div>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0, marginBottom: 6 }}>
          Algo se rompió en esta pantalla
        </h2>
        <p
          style={{
            fontSize: 13,
            color: 'var(--cc-txt-3)',
            maxWidth: '52ch',
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          Un error de servidor cortó la carga. La sesión sigue activa — puedes
          recargar o irte a otra parte del workspace mientras lo investigamos.
        </p>
      </div>

      {error.digest && (
        <div
          style={{
            padding: '8px 14px',
            background: 'var(--cc-bg-2)',
            border: '1px solid var(--cc-line-2)',
            borderRadius: 7,
            fontFamily: 'var(--cc-mono), monospace',
            fontSize: 11,
            color: 'var(--cc-txt-4)',
            letterSpacing: '0.04em',
          }}
        >
          ID del error: <code style={{ color: 'var(--cc-txt-2)' }}>{error.digest}</code>
        </div>
      )}

      {isDev && error.message && (
        <pre
          style={{
            padding: '12px 14px',
            background: 'rgba(255, 93, 93, 0.06)',
            border: '1px solid rgba(255, 93, 93, 0.3)',
            borderRadius: 7,
            fontFamily: 'var(--cc-mono), monospace',
            fontSize: 11,
            color: 'var(--cc-red, #ff5d5d)',
            maxWidth: '64ch',
            textAlign: 'left',
            whiteSpace: 'pre-wrap',
            margin: 0,
          }}
        >
          {error.message}
        </pre>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--cc-green)',
            color: '#070809',
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ↻ Reintentar
        </button>
        <Link
          href={'/app' as Route}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: '1px solid var(--cc-line-2)',
            background: 'transparent',
            color: 'var(--cc-txt-2)',
            fontFamily: 'inherit',
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

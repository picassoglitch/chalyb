import { useTranslations } from 'next-intl';
import { LandingNav } from '@/components/landing/nav';
import { LandingFooter } from '@/components/landing/footer';
import { ContactForm } from './contact-form';

// Shares the landing's minimal sticky nav + footer so /contacto keeps the
// same visual identity as the public site.
export function ContactPage({ isAuthenticated }: { isAuthenticated: boolean }) {
  const t = useTranslations('contact');

  return (
    <div className="lp">
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
              · {t('kicker')} ·
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
              {t('title')}
            </h1>
            <p
              style={{
                fontSize: 'clamp(15px, 2vw, 17px)',
                color: 'var(--ink-dim)',
                lineHeight: 1.55,
                maxWidth: '56ch',
              }}
            >
              {t('lead')}
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
            <span>· {t('notes.1')}</span>
            <span>· {t('notes.2')}</span>
            <span>· {t('notes.3')}</span>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { FusionLogo } from './fusion-logo';

export function LandingFooter() {
  const tFooter = useTranslations('footer');
  const tNav = useTranslations('nav');

  return (
    <footer>
      <div className="footer-top">
        <div className="footer-brand">
          <div className="logo">
            <FusionLogo id="footMark" />
            CHALYB
          </div>
          <p>{tFooter('brand')}</p>
        </div>
        <div className="footer-col">
          <h6>{tFooter('build')}</h6>
          <a href="#client-world">{tNav('client')}</a>
          <a href="#partner-world">{tNav('partner')}</a>
          <a href="#proof">{tFooter('track')}</a>
          {/* Dedicated contact form page — separate from the inline section
              on the landing, useful as a shareable link. */}
          <Link href={'/contacto' as Route}>{tFooter('contact')}</Link>
        </div>
        <div className="footer-col">
          <h6>{tFooter('earn')}</h6>
          <a href="#earn-world">{tFooter('bots')}</a>
          <a href="#earn-world">{tFooter('pricing')}</a>
          <a href="#contact">{tFooter('signin')}</a>
          <a href="#earn-world">Chalyb Academy</a>
        </div>
        <div className="footer-col">
          <h6>{tFooter('connect')}</h6>
          <a href="#">Kick</a>
          <a href="#">Instagram</a>
          <a href="#">TikTok</a>
          <a href="#">LinkedIn</a>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© 2026 Chalyb — chalyb.com</p>
        <div className="socials">
          {/* Real legal pages — required public URLs for OAuth provider apps
              (Google, Mercado Pago, etc.) and consumer-law compliance in MX.
              Routes live under /legal/ because the CDN-cached 404 on /terms
              and /privacy from before the routes existed never cleared even
              after manual purge — the /legal/ prefix gives them fresh cache
              keys that Vercel's edge has never seen. */}
          <Link href={'/legal/privacy' as Route}>{tFooter('privacy')}</Link>
          <Link href={'/legal/terms' as Route}>{tFooter('terms')}</Link>
          <a href="#">{tFooter('status')}</a>
        </div>
      </div>
    </footer>
  );
}

import type { Metadata } from 'next';
// The auth screens are on the Chalyb 2026 design system now (tokens, the
// public pages' card, the contact form's fields), not the legacy dark/gold
// globals.css.
import '@/styles/chalyb-tokens.css';
import '@/styles/chalyb-legal.css';
import '@/styles/chalyb-auth.css';

// Private routes stay out of search results. robots.txt already disallows
// them; this covers a crawler that reaches one through a link anyway.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return children;
}

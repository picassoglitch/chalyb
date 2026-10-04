import type { Metadata } from 'next';
// The legacy stylesheet (Tailwind + lp-/auth-/legal- classes). Not in the
// root layout any more: the rebuilt public pages don't use it, and it was
// their biggest render-blocking CSS (LANDING-SPEC §7).
import '../globals.css';

// Private routes stay out of search results. robots.txt already disallows
// them; this covers a crawler that reaches one through a link anyway.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return children;
}

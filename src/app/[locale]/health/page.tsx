import type { Metadata } from 'next';
import '../globals.css';

// A liveness probe, not a page for search: it inherited the site title and
// was crawlable.
export const metadata: Metadata = {
  title: 'Health',
  robots: { index: false, follow: false },
};

export default function HealthPage() {
  return <pre className="p-8 font-mono text-sm">scaffold-ok</pre>;
}

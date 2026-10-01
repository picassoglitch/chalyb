import type { Metadata } from 'next';

// Private routes stay out of search results. robots.txt already disallows
// them; this covers a crawler that reaches one through a link anyway.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return children;
}

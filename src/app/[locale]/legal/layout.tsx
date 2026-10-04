// Every /legal/* page (current, versioned and change logs) is still styled by
// the legacy stylesheet: .legal-prose and the lp- shell. It loads here, not
// in the root layout (LANDING-SPEC §7).
import '../globals.css';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return children;
}

'use client';

// "Compartir" (SCR-05): the Web Share API where it exists, copy-link
// fallback elsewhere.

import { useState } from 'react';
import { Share2 } from 'lucide-react';

export function ShareButton({
  url,
  title,
  label,
  ariaLabel,
  copiedLabel,
}: {
  url: string;
  title: string;
  label: string;
  ariaLabel?: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const abs = new URL(url, window.location.origin).href;
    if (typeof navigator.share === 'function') {
      await navigator.share({ title, url: abs }).catch(() => {});
      return;
    }
    await navigator.clipboard?.writeText(abs).catch(() => {});
    setCopied(true);
  }
  return (
    <>
      <button type="button" className="ch-btn ch-btn--secondary ch-btn--compact" onClick={share} aria-label={ariaLabel}>
        <Share2 aria-hidden="true" />
        {label}
      </button>
      {copied && (
        <span role="status" className="ch-muted" style={{ fontSize: 15 }}>
          {copiedLabel}
        </span>
      )}
    </>
  );
}

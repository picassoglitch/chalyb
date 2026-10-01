'use client';

// "Pegar" (SCR-02): fills the link field from the clipboard. Hidden where
// the Clipboard API can't read (it would be a button with no action).

import { useEffect, useState } from 'react';
import { ClipboardPaste } from 'lucide-react';

export function PasteButton({ targetId, label }: { targetId: string; label: string }) {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection after mount
    setSupported(typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function');
  }, []);
  if (!supported) return null;
  return (
    <button
      type="button"
      className="ch-btn ch-btn--secondary ch-btn--compact"
      onClick={async () => {
        const text = await navigator.clipboard.readText().catch(() => '');
        const input = document.getElementById(targetId) as HTMLInputElement | null;
        if (input && text) {
          input.value = text.trim();
          input.focus();
        }
      }}
    >
      <ClipboardPaste aria-hidden="true" />
      {label}
    </button>
  );
}

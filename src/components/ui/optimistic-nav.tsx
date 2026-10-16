'use client';
// Instant feedback for a row of links that switch a screen (tool tabs, the
// Clips subnav, the source picker, chips): the clicked link shows as picked
// on the click itself, while the server renders the new screen. As soon as
// the screen's own choice (`current`) changes, it wins again, so a redirect
// lands on the right one marked.

import { useState, type MouseEvent } from 'react';

/** A plain left click that the router will handle in place (not a new tab). */
export function isPlainClick(e: MouseEvent<HTMLElement>): boolean {
  return (
    !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
  );
}

/** The key to show as picked: the one just clicked while `current` hasn't
 *  changed yet, else `current`. */
export function useOptimisticPick<K extends string>(current: K | null) {
  const [picked, setPicked] = useState<{ key: K; from: K | null } | null>(null);
  const shown = picked && picked.from === current ? picked.key : current;
  const pick = (key: K) => (e: MouseEvent<HTMLElement>) => {
    if (isPlainClick(e)) setPicked({ key, from: current });
  };
  return { shown, pick };
}

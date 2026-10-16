'use client';
import { useEffect, useState } from 'react';
import { useChalito } from './provider';
import { useMyCard } from './useMyCard';
import { CARD_WAIT_MS, loadLastCompanion, saveLastCompanion, type CompanionShown, type LastCompanion } from './companion';

/**
 * Where the person's own custom card stands, for anything that draws their companion: unknown
 * until the api answers (or CARD_WAIT_MS passes: the roster avatar then), and this browser's last
 * look for the account (read after hydration, so the server renders the stand-in).
 */
export const useOwnCard = () => {
  const { hubUserId, myCard: source } = useChalito();
  const mine = useMyCard();
  const [waitOver, setWaitOver] = useState(false);
  useEffect(() => {
    if (!source || mine.known) return;
    const t = setTimeout(() => setWaitOver(true), CARD_WAIT_MS);
    return () => clearTimeout(t);
  }, [source, mine.known]);
  const [last, setLast] = useState<LastCompanion | null>(null);
  useEffect(() => setLast(loadLastCompanion(hubUserId ?? undefined)), [hubUserId]);
  const card = mine.card ? ('custom' as const) : mine.known || waitOver ? ('none' as const) : ('unknown' as const);
  return { mine, card, last };
};

/** Remembers the account's settled look for next time (never a guess from the cache itself). */
export const useRememberLook = (shown: CompanionShown, known: boolean) => {
  const { hubUserId } = useChalito();
  const shownId = shown.kind === 'roster' ? shown.id : null;
  const shownKey = shownId ?? shown.kind;
  useEffect(() => {
    if (!known || !hubUserId || shownKey === 'pending') return;
    saveLastCompanion(
      shownId ? { owner: hubUserId, kind: 'roster', id: shownId } : { owner: hubUserId, kind: 'custom' },
    );
  }, [known, hubUserId, shownKey, shownId]);
  return shownKey;
};

'use client';

// "Intentar otra vez" retries in place (a server refresh, not a full
// reload) with "Intentando…". After 3 failed tries the primary button
// becomes "Hablar con una persona" (TOOLS-SPEC §7.1).

import { useEffect, useState, useTransition } from 'react';
import type { Route } from 'next';
import { RotateCw, MessageCircle } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';

const KEY = (slug: string) => `chalyb.toolRetry.${slug}`;

function readTries(slug: string): number {
  try {
    return Number(sessionStorage.getItem(KEY(slug)) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function ToolRetry({
  slug,
  helpHref,
  labels,
}: {
  slug: string;
  helpHref: string;
  labels: { retry: string; retrying: string; human: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tries, setTries] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after mount
    setTries(readTries(slug));
  }, [slug]);

  function retry() {
    const n = tries + 1;
    setTries(n);
    try {
      sessionStorage.setItem(KEY(slug), String(n));
    } catch {}
    start(() => router.refresh());
  }

  const human = (
    <Link
      href={helpHref as Route}
      className={`ch-btn ${tries >= 3 ? 'ch-btn--primary' : 'ch-btn--okline'}`}
    >
      <MessageCircle aria-hidden="true" />
      {labels.human}
    </Link>
  );
  if (tries >= 3) return <div className="ch-toolerr__btns">{human}</div>;
  return (
    <div className="ch-toolerr__btns">
      <button type="button" className="ch-btn ch-btn--primary" onClick={retry} disabled={pending}>
        <RotateCw aria-hidden="true" />
        {pending ? labels.retrying : labels.retry}
      </button>
      {human}
    </div>
  );
}

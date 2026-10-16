'use client';
// On the hub sign-in page: a signed-out person opened Chalito's "Aprobar computadora" link
// (/app/chalito/computadoras/aprobar#c=<codeId>). The browser keeps the fragment across the
// redirect to /sign-in, but the round-trip back (email or Google) drops it, so it is stashed
// here, in this tab only, and the approval page picks it up (ADR 0028 §3).
import { useEffect } from 'react';
import { headedToApproval, stashHandoff } from '@/lib/chalito/web/approve-computer';

export const HandoffStash = () => {
  useEffect(() => {
    try {
      if (headedToApproval(window.location.search))
        stashHandoff(window.sessionStorage, window.location.hash, Date.now());
    } catch {
      /* storage blocked: the person can still type the code on the computer's screen */
    }
  }, []);
  return null;
};

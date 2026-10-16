'use client';
// On the hub sign-in page: a signed-out person opened Chalito's "Aprobar computadora" link
// (/app/chalito/computadoras/aprobar#c=<codeId>&p=<port>). The browser keeps the fragment across
// the redirect to /sign-in, but the round-trip back drops it, so it is stashed here, in this tab
// only, and the approval page picks it up (ADR 0028 §3). Google sign-in comes back to this tab;
// an email magic link opened in a new tab doesn't (sessionStorage is per tab): there the page asks
// for the code shown on the computer instead.
import { useEffect } from 'react';
import { headedToApproval, stashHandoff, stripHash } from '@/lib/chalito/web/approve-computer';

export const HandoffStash = () => {
  useEffect(() => {
    try {
      if (headedToApproval(window.location.search)) {
        stashHandoff(window.sessionStorage, window.location.hash, Date.now());
        // Out of the address bar right away (history, analytics).
        stripHash(window.location, window.history);
      }
    } catch {
      /* storage blocked: the person can still type the code on the computer's screen */
    }
  }, []);
  return null;
};

/**
 * On the approval page itself, outside its gate: keep the link (this browser may first need to be
 * activated or endorsed, which can leave the page) and take it out of the address bar at once.
 */
export const KeepApprovalLink = () => {
  useEffect(() => {
    try {
      stashHandoff(window.sessionStorage, window.location.hash, Date.now());
    } catch {
      /* storage blocked */
    }
    stripHash(window.location, window.history);
  }, []);
  return null;
};

// Which links a "Crear mis clips" submission starts (the main one plus
// "Subir varios videos a la vez"). Every link is checked against the
// re-upload block (Uso aceptable §5.2.3) BEFORE any job starts: a blocked
// one, main or extra, stops the batch with the same content_blocked message
// instead of being skipped in silence (7a review, LOW). An extra the hub
// can't read is still skipped, as before.

import { checkSourceUrl } from './adapters/run-job';
import { extraLinks } from './clips-options';
import type { ClipFailureReason } from './adapters/types';

export async function planClipLinks(
  mainRaw: string,
  moreRaw: unknown,
  isBlocked: (url: string) => Promise<boolean>,
): Promise<{ ok: true; links: string[] } | { ok: false; reason: ClipFailureReason }> {
  const main = checkSourceUrl(mainRaw);
  if (!main.ok) return main;
  const links = [main.url];
  for (const raw of extraLinks(moreRaw, main.url)) {
    const extra = checkSourceUrl(raw);
    if (extra.ok) links.push(extra.url);
  }
  for (const url of links)
    if (await isBlocked(url)) return { ok: false, reason: 'content_blocked' };
  return { ok: true, links };
}

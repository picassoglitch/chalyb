// GET /api/tools/chalito/push-text — the Chalito service worker's notification text
// (public/chalito-sw.js), from Chalito's message catalogs like every other string.
// Static: built once, cached by the worker.
import es from '@/lib/chalito/messages/es.json';
import en from '@/lib/chalito/messages/en.json';

export const dynamic = 'force-static';

export const GET = () =>
  Response.json({ es: es.live.push.notification, en: en.live.push.notification });

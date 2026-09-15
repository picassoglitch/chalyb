// The Chalyb kit, as a static list. One subscription, many inner tools.
//
// The database is the source of truth for status, tier gate and copy of each
// engine; this list exists for the surfaces that must teach the bundle even
// when the catalog query returns nothing (an empty fleet, a public page with
// no session, a filter with zero matches). Slugs match `engines.slug` so a
// DB row can be matched back to its glyph and one-liner.

export interface KitTool {
  slug: string;
  name: string;
  /** What it does, one line, Spanish-first. */
  purpose: string;
}

export const KIT_TOOLS: KitTool[] = [
  { slug: 'chalybclip', name: 'ChalyClip', purpose: 'Convierte tus streams en clips listos para publicar.' },
  { slug: 'chalybcrypto', name: 'ChalyCrypto', purpose: 'Señales y automatización de trading cripto.' },
  { slug: 'chalybobs', name: 'ChalyOBS', purpose: 'Controla tu transmisión en vivo desde un panel.' },
  { slug: 'chalybstream', name: 'ChalybStreamManager', purpose: 'Un solo control para TikTok, Twitch, Kick y YouTube.' },
  { slug: 'chalybbot', name: 'ChalybBot', purpose: 'Bots de Telegram con persona IA para atención y ventas.' },
  { slug: 'chalybpicks', name: 'ChalybPicks', purpose: 'Picks deportivos con razonamiento IA y tracking.' },
  { slug: 'chalybrealtor', name: 'ChalybRealtor', purpose: 'Captura y enruta leads inmobiliarios en México.' },
  { slug: 'chalybtrade', name: 'ChalybTrade', purpose: 'Trading asíncrono en mercados de predicción.' },
];

export function kitToolBySlug(slug: string): KitTool | undefined {
  return KIT_TOOLS.find((t) => t.slug === slug);
}

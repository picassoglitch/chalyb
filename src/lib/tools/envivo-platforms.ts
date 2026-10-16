// En vivo's platform catalogue and broadcast-metadata schema, mirrored from
// the engine (ChalyOBS web/src/lib/destinations.ts) so the hub screens show
// exactly what the engine accepts. Pure data + helpers, safe on the client.
// Platform names are product names (the same in every language); every
// sentence the screens show lives in messages/*.json (liveTool.*).

export const PLATFORM_IDS = [
  'kick',
  'twitch',
  'youtube',
  'tiktok',
  'facebook',
  'instagram',
  'restream',
  'custom_rtmp',
  'custom_srt',
] as const;
export type PlatformId = (typeof PLATFORM_IDS)[number];

export interface PlatformMeta {
  name: string;
  /** Fixed ingest URL the engine pre-fills; '' when the person types it. */
  ingestHint: string;
  color: string;
  /** The engine fans out to it (Instagram has no external RTMP). */
  supportsBroadcast: boolean;
}

export const PLATFORM_META: Record<PlatformId, PlatformMeta> = {
  kick: {
    name: 'Kick',
    ingestHint: 'rtmps://fa723fc1b171.global-contribute.live-video.net:443/app',
    color: '#53fc18',
    supportsBroadcast: true,
  },
  twitch: {
    name: 'Twitch',
    ingestHint: 'rtmp://live.twitch.tv/app',
    color: '#9146ff',
    supportsBroadcast: true,
  },
  youtube: {
    name: 'YouTube Live',
    ingestHint: 'rtmp://a.rtmp.youtube.com/live2',
    color: '#ff0000',
    supportsBroadcast: true,
  },
  tiktok: { name: 'TikTok Live', ingestHint: '', color: '#111111', supportsBroadcast: true },
  facebook: {
    name: 'Facebook Live',
    ingestHint: 'rtmps://live-api-s.facebook.com:443/rtmp',
    color: '#1877f2',
    supportsBroadcast: true,
  },
  instagram: { name: 'Instagram Live', ingestHint: '', color: '#e1306c', supportsBroadcast: false },
  restream: {
    name: 'Restream',
    ingestHint: 'rtmp://live.restream.io/live',
    color: '#ff6b00',
    supportsBroadcast: true,
  },
  custom_rtmp: { name: 'RTMP', ingestHint: '', color: '#5b4bff', supportsBroadcast: true },
  custom_srt: { name: 'SRT', ingestHint: '', color: '#5b4bff', supportsBroadcast: true },
};

/** Platforms with one-click OAuth on the engine (the rest paste a key). */
export const OAUTH_PLATFORMS = ['kick', 'twitch', 'youtube'] as const;
export type OAuthPlatform = (typeof OAUTH_PLATFORMS)[number];

export function isPlatformId(v: unknown): v is PlatformId {
  return typeof v === 'string' && (PLATFORM_IDS as readonly string[]).includes(v);
}

export function isOAuthPlatform(v: unknown): v is OAuthPlatform {
  return typeof v === 'string' && (OAUTH_PLATFORMS as readonly string[]).includes(v);
}

export const isCustomPlatform = (p: PlatformId) => p === 'custom_rtmp' || p === 'custom_srt';

// ── Broadcast metadata ("Actualizar títulos") ─────────────────────────
export type Visibility = 'public' | 'unlisted' | 'private';

export interface BroadcastMeta {
  title: string;
  description: string;
  category: string;
  tags: string[];
  /** ISO-639-1, '' when unset. */
  language: string;
  visibility: Visibility;
  madeForKids: boolean;
  mature: boolean;
}

export type BroadcastFieldId = keyof BroadcastMeta;

export const BROADCAST_FIELDS: {
  id: BroadcastFieldId;
  kind: 'text' | 'textarea' | 'tags' | 'select' | 'toggle';
}[] = [
  { id: 'title', kind: 'text' },
  { id: 'description', kind: 'textarea' },
  { id: 'category', kind: 'text' },
  { id: 'tags', kind: 'tags' },
  { id: 'language', kind: 'select' },
  { id: 'visibility', kind: 'select' },
  { id: 'madeForKids', kind: 'toggle' },
  { id: 'mature', kind: 'toggle' },
];

/** Language codes the engine offers; the labels are the languages' own names. */
export const LANGUAGE_OPTIONS: { value: string; label: string | null }[] = [
  { value: '', label: null },
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
];

export const VISIBILITIES: Visibility[] = ['public', 'unlisted', 'private'];

/** Which fields each platform consumes (engine PLATFORM_FIELD_SUPPORT). */
export const PLATFORM_FIELD_SUPPORT: Record<PlatformId, BroadcastFieldId[]> = {
  twitch: ['title', 'category', 'tags', 'language', 'mature'],
  youtube: ['title', 'description', 'category', 'tags', 'language', 'visibility', 'madeForKids'],
  kick: ['title', 'category', 'mature'],
  facebook: ['title', 'description', 'mature'],
  tiktok: ['title'],
  instagram: [],
  restream: ['title'],
  custom_rtmp: ['title'],
  custom_srt: ['title'],
};

const LIMITS = { title: 200, description: 5000, category: 200, tag: 100, tags: 30 };

/** Untrusted JSON → a complete BroadcastMeta (engine normalizeBroadcastMeta,
 *  plus length caps so the BFF never forwards an oversized body). */
export function normalizeBroadcastMeta(raw: unknown, fallbackTitle: string): BroadcastMeta {
  const m = raw && typeof raw === 'object' ? (raw as Partial<Record<string, unknown>>) : {};
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  const title = str(m.title, LIMITS.title);
  const visibility: Visibility =
    m.visibility === 'unlisted' || m.visibility === 'private' ? m.visibility : 'public';
  const language = str(m.language, 8);
  return {
    title: title.trim().length > 0 ? title : fallbackTitle,
    description: str(m.description, LIMITS.description),
    category: str(m.category, LIMITS.category),
    tags: Array.isArray(m.tags)
      ? m.tags
          .filter((t): t is string => typeof t === 'string')
          .map((t) => t.slice(0, LIMITS.tag))
          .slice(0, LIMITS.tags)
      : [],
    language: LANGUAGE_OPTIONS.some((o) => o.value === language) ? language : '',
    visibility,
    madeForKids: m.madeForKids === true,
    mature: m.mature === true,
  };
}

/** The connected platforms (in catalogue order) that will receive a field. */
export function fieldTargets(field: BroadcastFieldId, connected: PlatformId[]): PlatformId[] {
  const set = new Set(connected);
  return PLATFORM_IDS.filter((p) => set.has(p) && PLATFORM_FIELD_SUPPORT[p].includes(field));
}

/** Engine rule: a destination can go ON only with an ingest URL and a key. */
export function destinationConfigured(d: { ingestUrl: string; hasStreamKey: boolean }): boolean {
  return d.ingestUrl.trim().length > 0 && d.hasStreamKey;
}

/** What the person may type as an ingest URL (engine fans out rtmp/rtmps/srt). */
export function validIngestUrl(v: string): boolean {
  const s = v.trim();
  return s === '' || /^(rtmps?|srt):\/\/\S+$/i.test(s);
}

/** "rtmp://host/live" + key → the one-field URL for phones and cameras. */
export function fullRtmpUrl(rtmpUrl: string, key: string): string {
  return `${rtmpUrl.replace(/\/+$/, '')}/${key}`;
}

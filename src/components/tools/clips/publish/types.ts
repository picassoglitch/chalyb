// Shapes the engine's /api/hub/v1/publish answers with (ChalyClip
// chalybclip/api/routers/hub_publish.py + routers/zernio.py). Pure types.

export interface PublishPlatform {
  id: string;
  label: string;
}

export interface PublishAccount {
  platform: string;
  account_id: string;
}

export interface HistoryItem {
  post_id: string;
  kind: 'zernio' | 'manual';
  clip_id: string | null;
  title: string | null;
  platforms: string[];
  content: string | null;
  created_at: string | null;
  scheduled_for?: string | null;
  status: string;
}

export interface PublishableClip {
  id: string;
  stream_id: string | null;
  duration_s: number;
  title: string;
  status: string;
}

export interface Draft {
  post_id: string;
  clip_id: string;
  platforms: string[];
  content: string | null;
  created_at: string;
  scheduled_for: string | null;
}

export interface Overview {
  ok: boolean;
  configured: boolean;
  profile: { id: string; name: string | null } | null;
  accounts: PublishAccount[];
  account_limit: number | null;
  account_count: number;
  connect_fetch_failed: boolean;
  platforms: PublishPlatform[];
  community_platforms: PublishPlatform[];
  community_connected: string[];
  stats: { published: number; failed: number; scheduled: number; total: number };
  history: HistoryItem[];
  published_clip_ids: string[];
  publishable: PublishableClip[];
  publishable_total: number;
  drafts: Draft[];
  is_pro: boolean;
  feature_ads: boolean;
  feature_whatsapp: boolean;
}

export const PUBLISH_TABS = [
  'uno',
  'varios',
  'publicados',
  'rendimiento',
  'calendario',
  'programacion',
  'piloto',
  'comentarios',
  'dms',
  'crecimiento',
  'comunidad',
] as const;
export type PublishTab = (typeof PUBLISH_TABS)[number];

export function isPublishTab(v: unknown): v is PublishTab {
  return typeof v === 'string' && (PUBLISH_TABS as readonly string[]).includes(v);
}

/** Terminal post states: the job page stops polling. */
export const TERMINAL_STATUSES = [
  'PUBLISHED',
  'FINISHED',
  'SUCCESS',
  'FAILED',
  'ERROR',
  'UNAVAILABLE',
] as const;

export function isTerminalStatus(s: string | null | undefined): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(String(s ?? '').toUpperCase());
}

/** history/calendar status → pill kind. */
export function statusKind(s: string | null | undefined): 'ok' | 'bad' | 'acc' | 'gray' {
  const v = String(s ?? '').toLowerCase();
  if (['published', 'finished', 'success'].includes(v)) return 'ok';
  if (['failed', 'error'].includes(v)) return 'bad';
  if (['scheduled', 'pending', 'queued', 'publishing', 'processing', ''].includes(v)) return 'acc';
  return 'gray';
}

export interface PlatformRow {
  platform: string;
  ok: boolean;
  status: string;
  url: string | null;
  postId: string;
  error: string | null;
}

/** Zernio sends per-platform results as a list or as a dict by platform. */
export function normalizePlatforms(raw: unknown): PlatformRow[] {
  if (!raw || typeof raw !== 'object') return [];
  const rows: Record<string, unknown>[] = Array.isArray(raw)
    ? raw.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    : Object.entries(raw as Record<string, unknown>).map(([k, v]) => {
        const o: Record<string, unknown> =
          v && typeof v === 'object' ? { ...(v as Record<string, unknown>) } : { status: v };
        if (!o.platform) o.platform = k;
        return o;
      });
  const s = (v: unknown) => (typeof v === 'string' && v ? v : null);
  return rows.map((v) => {
    const status = s(v.status) ?? (v.success === true ? 'PUBLISHED' : 'UNKNOWN');
    const ok = v.success === true || /^(PUBLISHED|FINISHED|SUCCESS)$/i.test(status);
    const url = s(v.url) ?? s(v.postUrl) ?? s(v.platformPostUrl);
    return {
      platform: s(v.platform) ?? '',
      ok,
      status: status.toUpperCase(),
      url: url && /^https?:\/\//.test(url) ? url : null,
      postId: s(v.postId) ?? s(v.platform_post_id) ?? s(v.platformPostId) ?? s(v.id) ?? '',
      error: s(v.error) ?? s(v.errorMessage),
    };
  });
}

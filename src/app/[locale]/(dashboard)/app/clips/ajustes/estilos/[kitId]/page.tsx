import type { Metadata, Route } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { engineRead, loadClipsEngine } from '@/lib/tools/clips-engine';
import { getKit, listKits } from '@/lib/tools/adapters/clips/engine-api';
import { ToolShell } from '@/components/tools/tool-shell';
import { ClipsGateView, ClipsReadError } from '@/components/tools/clips/engine/gate';
import { KitForm, type KitValues } from '@/components/tools/clips/engine/kit-form';
import { CAPTION_PRESET_IDS, kitCopy } from '@/components/tools/clips/engine/copy';
import '@/styles/tools-clips.css';
import '@/styles/tools-clips-engine.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clipsEngine.styles');
  return { title: t('metaEdit') };
}

// One style (brand kit): /app/clips/ajustes/estilos/nuevo creates one.

const BLANK: KitValues = {
  name: '',
  handle_tiktok: '',
  handle_youtube: '',
  handle_instagram: '',
  handle_kick: '',
  caption_preset: 'karaoke_pop',
  forward_phrases: '',
  retroactive_phrases: '',
  safe_schedule_enabled: false,
  content_timezone: 'UTC',
  safety_preset: 'recommended',
  show_chalybclip_outro: true,
  is_default: false,
};

export default async function ClipsStylePage({
  params,
}: {
  params: Promise<{ locale: string; kitId: string }>;
}) {
  const { locale, kitId } = await params;
  setRequestLocale(locale);
  const isNew = kitId === 'nuevo';
  if (!isNew && !/^[A-Za-z0-9_-]{1,64}$/.test(kitId)) notFound();
  const g = await loadClipsEngine(locale, `/app/clips/ajustes/estilos/${kitId}`);
  if (g.kind !== 'ready') return <ClipsGateView gate={g} tab="settings" />;
  const res = await engineRead(g, async (e, signal) => {
    // The list and the kit are independent reads: both at once.
    const [list, one] = await Promise.all([
      listKits(e, signal),
      isNew ? null : getKit(e, kitId, signal),
    ]);
    return { list, kit: one ? one.kit : null };
  });
  if (!res.ok) {
    if (res.error.reason === 'not_found') notFound();
    return <ClipsReadError error={res.error} tab="settings" />;
  }
  const { list, kit } = res.data;
  const t = await getTranslations('clipsEngine.styles');
  const initial: KitValues = kit
    ? {
        name: kit.name,
        handle_tiktok: kit.handles.tiktok ?? '',
        handle_youtube: kit.handles.youtube ?? '',
        handle_instagram: kit.handles.instagram ?? '',
        handle_kick: kit.handles.kick ?? '',
        caption_preset: kit.caption_preset,
        forward_phrases: kit.forward_phrases.join('\n'),
        retroactive_phrases: kit.retroactive_phrases.join('\n'),
        safe_schedule_enabled: kit.safe_schedule_enabled,
        content_timezone: kit.content_timezone,
        safety_preset: kit.safety_preset,
        show_chalybclip_outro: kit.show_chalybclip_outro,
        is_default: kit.is_default,
      }
    : BLANK;
  const presets = list.caption_presets.filter((p) =>
    (CAPTION_PRESET_IDS as readonly string[]).includes(p),
  );

  return (
    <ToolShell slug="chalybclip" tab="settings">
      <div className="ch-ce-stack" style={{ maxWidth: 900 }}>
        <Link href={'/app/clips/ajustes/estilos' as Route} className="ch-lnk">
          {t('back')}
        </Link>
        <h2 className="ch-h2">{kit ? t('editTitle', { nombre: kit.name }) : t('newTitle')}</h2>
        <KitForm
          kitId={kit?.id ?? null}
          initial={initial}
          presets={presets.length ? presets : [...CAPTION_PRESET_IDS]}
          freeTier={list.tier === 'free'}
          logoSvg={kit?.logo_svg ?? null}
          copy={await kitCopy()}
        />
      </div>
    </ToolShell>
  );
}

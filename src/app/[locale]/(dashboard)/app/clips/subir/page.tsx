import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CloudOff } from 'lucide-react';
import { engineRead, loadClipsEngine } from '@/lib/tools/clips-engine';
import { getStart } from '@/lib/tools/adapters/clips/engine-api';
import { ToolShell } from '@/components/tools/tool-shell';
import { ClipsGateView, ClipsReadError } from '@/components/tools/clips/engine/gate';
import { UploadForm } from '@/components/tools/clips/engine/upload-form';
import { uploadCopy } from '@/components/tools/clips/engine/copy';
import { StateBlock } from '@/components/ui/primitives';
import '@/styles/tools-clips.css';
import '@/styles/tools-clips-engine.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clipsEngine.upload');
  return { title: t('metaTitle') };
}

// Subir un video (mode "a"): the browser sends the file straight to the
// engine's storage with a short-lived signed URL the hub asks for; the app
// server never carries the bytes. Needs a persona (the engine writes the
// captions with it) and storage on the engine.

export default async function ClipsUploadPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await loadClipsEngine(locale, '/app/clips/subir');
  if (g.kind !== 'ready') return <ClipsGateView gate={g} tab="main" />;
  const res = await engineRead(g, (e, signal) => getStart(e, signal));
  if (!res.ok) return <ClipsReadError error={res.error} tab="main" />;
  const t = await getTranslations('clipsEngine.upload');
  const start = res.data;

  return (
    <ToolShell slug="chalybclip" tab="main">
      <div className="ch-ce-stack" style={{ maxWidth: 760 }}>
        <header>
          <h2 className="ch-h2">{t('title')}</h2>
          <p className="ch-sub">{t('sub')}</p>
        </header>
        {!start.upload.enabled ? (
          <StateBlock
            icon={<CloudOff />}
            title={t('off.title')}
            body={t('off.body')}
            action={{ href: '/app/clips/nuevo', label: t('off.cta') }}
          />
        ) : !start.has_persona ? (
          <StateBlock
            icon={<CloudOff />}
            title={t('noPersona.title')}
            body={t('noPersona.body')}
            action={{ href: '/app/clips/ajustes/personas', label: t('noPersona.cta') }}
          />
        ) : (
          <section className="ch-card ch-ce-card">
            <UploadForm copy={await uploadCopy()} maxBytes={start.upload.max_bytes} />
          </section>
        )}
      </div>
    </ToolShell>
  );
}

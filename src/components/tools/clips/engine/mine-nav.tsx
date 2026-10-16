// "Mis clips" | "Mis videos" under the Mis clips tab (mode "a" only: the
// engine keeps the videos the clips came from).

import { getTranslations } from 'next-intl/server';
import { ClipsSubnav } from './subnav';

export async function MineNav({
  current,
}: {
  current: '/app/clips/mis-clips' | '/app/clips/videos';
}) {
  const t = await getTranslations('clipsEngine.nav');
  return (
    <ClipsSubnav
      label={t('mineAria')}
      current={current}
      items={[
        { href: '/app/clips/mis-clips', label: t('clips') },
        { href: '/app/clips/videos', label: t('videos') },
      ]}
    />
  );
}

export async function SettingsNav({ current, admin }: { current: string; admin: boolean }) {
  const t = await getTranslations('clipsEngine.nav');
  const items = [
    { href: '/app/clips/ajustes', label: t('general') },
    { href: '/app/clips/ajustes/estilos', label: t('styles') },
    { href: '/app/clips/ajustes/personas', label: t('personas') },
    { href: '/app/clips/canales', label: t('channels') },
    { href: '/app/clips/en-vivo', label: t('live') },
    { href: '/app/clips/ajustes/calibracion', label: t('calibration') },
  ];
  if (admin)
    items.push(
      { href: '/app/clips/ajustes/consumo', label: t('llmCalls') },
      { href: '/app/clips/ajustes/motor', label: t('llmSettings') },
      { href: '/app/clips/ajustes/sitio', label: t('site') },
    );
  return <ClipsSubnav label={t('settingsAria')} current={current} items={items} />;
}

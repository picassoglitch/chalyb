// Ajustes de Clips in mode "a": the engine's real settings, one row each —
// styles (brand kits), personas, watched channels, live, calibration, and
// for engine admins the AI log, AI setup and site prices.

import { getTranslations } from 'next-intl/server';
import {
  Activity,
  Gauge,
  Globe,
  Palette,
  Radio,
  ReceiptText,
  Server,
  Tv,
  UserRound,
} from 'lucide-react';
import { clipSourceHref } from '@/lib/tools/clips-sources';
import { Group, Row } from '@/components/ui/primitives';

export async function EngineSettingsLinks({ admin }: { admin: boolean }) {
  const t = await getTranslations('clipsEngine.settings');
  return (
    <>
      <Group title={t('groupClips')}>
        <Row
          icon={<Palette />}
          iconColor="#5b4bff"
          title={t('styles')}
          detail={t('stylesSub')}
          href="/app/clips/ajustes/estilos"
        />
        <Row
          icon={<UserRound />}
          iconColor="#ff9f0a"
          title={t('personas')}
          detail={t('personasSub')}
          href="/app/clips/ajustes/personas"
        />
        <Row
          icon={<Tv />}
          iconColor="#0a84ff"
          title={t('channels')}
          detail={t('channelsSub')}
          href={clipSourceHref('canal')}
        />
        <Row
          icon={<Radio />}
          iconColor="#ff375f"
          title={t('live')}
          detail={t('liveSub')}
          href={clipSourceHref('transmision')}
        />
        <Row
          icon={<Gauge />}
          iconColor="#30b0c7"
          title={t('calibration')}
          detail={t('calibrationSub')}
          href="/app/clips/ajustes/calibracion"
        />
      </Group>
      {admin && (
        <Group title={t('groupAdmin')}>
          <Row
            icon={<ReceiptText />}
            title={t('llmCalls')}
            detail={t('llmCallsSub')}
            href="/app/clips/ajustes/consumo"
          />
          <Row
            icon={<Server />}
            title={t('llmSettings')}
            detail={t('llmSettingsSub')}
            href="/app/clips/ajustes/motor"
          />
          <Row
            icon={<Globe />}
            title={t('site')}
            detail={t('siteSub')}
            href="/app/clips/ajustes/sitio"
          />
        </Group>
      )}
      <p className="ch-ce-note">
        <Activity aria-hidden="true" style={{ width: 16, height: 16, verticalAlign: 'middle' }} />{' '}
        {t('balanceNote')}
      </p>
    </>
  );
}

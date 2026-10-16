// Copy for the Clips engine client components, from messages (clipsEngine.*).

import 'server-only';
import { getTranslations } from 'next-intl/server';
import type { ErrorCopy } from './tool-call';
import type { UploadCopy } from './upload-form';
import type { StreamActionsCopy } from './stream-actions';
import type { LivePanelCopy } from './live-panel';
import type { SourcesCopy } from './sources-panel';
import type { PersonasCopy } from './personas-panel';
import type { KitCopy } from './kit-form';
import type { SiteCopy } from './site-form';

export const CAPTION_PRESET_IDS = ['karaoke_pop', 'typewriter', 'bold_block', 'subtle'] as const;
export const SAFETY_IDS = ['recommended', 'cautious', 'active'] as const;

export async function errorCopy(): Promise<ErrorCopy> {
  const t = await getTranslations('clipsEngine.errors');
  return {
    generic: t('generic'),
    code: t.raw('code') as string,
    session: t('session'),
    no_credits: t('no_credits'),
    rate_limited: t('rate_limited'),
    too_large: t('too_large'),
    needs_plan: t('needs_plan'),
    not_found: t('not_found'),
    bad_request: t('bad_request'),
    forbidden: t('forbidden'),
    timeout: t('timeout'),
  };
}

export async function uploadCopy(): Promise<UploadCopy> {
  const t = await getTranslations('clipsEngine.upload');
  const b = await getTranslations('clipsEngine.boost');
  return {
    drop: t('drop'),
    dropHint: t('dropHint'),
    formats: t('formats'),
    chosen: t.raw('chosen') as string,
    boost: b('label'),
    boostHint: b('hint'),
    start: t('start'),
    uploading: t('uploading'),
    checking: t('checking'),
    cancel: t('cancel'),
    cancelled: t('cancelled'),
    keepOpen: t('keepOpen'),
    tooBig: t('tooBig'),
    badType: t('badType'),
    putFailed: t('putFailed'),
    errors: await errorCopy(),
  };
}

export async function streamActionsCopy(): Promise<StreamActionsCopy> {
  const t = await getTranslations('clipsEngine.video.actions');
  const b = await getTranslations('clipsEngine.boost');
  return {
    approveAll: t('approveAll'),
    approved: t.raw('approved') as string,
    download: t('download'),
    preparing: t('preparing'),
    rerunTitle: t('rerunTitle'),
    persona: t('persona'),
    boost: b('label'),
    boostHint: b('hint'),
    rerunGo: t('rerunGo'),
    deleteVideo: t('delete'),
    deleteConfirm: t('deleteConfirm'),
    deleteYes: t('deleteYes'),
    deleteNo: t('deleteNo'),
    working: t('working'),
    errors: await errorCopy(),
  };
}

export async function liveCopy(): Promise<LivePanelCopy> {
  const t = await getTranslations('clipsEngine.live');
  return {
    server: t('server'),
    key: t('key'),
    show: t('show'),
    hide: t('hide'),
    copy: t('copy'),
    copied: t('copied'),
    noKey: t('noKey'),
    makeKey: t('makeKey'),
    rotate: t('rotate'),
    rotateConfirm: t('rotateConfirm'),
    rotateYes: t('rotateYes'),
    rotateNo: t('rotateNo'),
    rotated: t('rotated'),
    working: t('working'),
    connection: t('connection'),
    connectionOn: t('connectionOn'),
    connectionOff: t('connectionOff'),
    errors: await errorCopy(),
  };
}

export async function sourcesCopy(): Promise<SourcesCopy> {
  const t = await getTranslations('clipsEngine.sources');
  return {
    addTitle: t('addTitle'),
    url: t('url'),
    urlPh: t('urlPh'),
    platform: t('platform'),
    platformAuto: t('platformAuto'),
    persona: t('persona'),
    max: t('max'),
    label: t('label'),
    labelPh: t('labelPh'),
    language: t('language'),
    languagePh: t('languagePh'),
    cadence: t('cadence'),
    cadences: Object.fromEntries(
      ['1', '2', '4', '6', '12', '24'].map((n) => [n, t(`cadences.${n}`)]),
    ),
    add: t('add'),
    added: t('added'),
    already: t('already'),
    listTitle: t('listTitle'),
    empty: t('empty'),
    watching: t('watching'),
    paused: t('paused'),
    seen: t.raw('seen') as string,
    lastPoll: t('lastPoll'),
    never: t('never'),
    pollNow: t('pollNow'),
    scanning: t('scanning'),
    remove: t('remove'),
    removeConfirm: t('removeConfirm'),
    working: t('working'),
    errors: await errorCopy(),
  };
}

export async function personasCopy(): Promise<PersonasCopy> {
  const t = await getTranslations('clipsEngine.personas');
  return {
    newTitle: t('newTitle'),
    editTitle: t('editTitle'),
    id: t('id'),
    idHint: t('idHint'),
    name: t('name'),
    language: t('language'),
    targets: t('targets'),
    targetsHint: t('targetsHint'),
    prompt: t('prompt'),
    tags: t('tags'),
    tagsHint: t('tagsHint'),
    create: t('create'),
    save: t('save'),
    cancel: t('cancel'),
    edit: t('edit'),
    saved: t('saved'),
    exists: t('exists'),
    empty: t('empty'),
    listTitle: t('listTitle'),
    working: t('working'),
    errors: await errorCopy(),
  };
}

export async function kitCopy(): Promise<KitCopy> {
  const t = await getTranslations('clipsEngine.kit');
  return {
    identity: t('identity'),
    name: t('name'),
    namePh: t('namePh'),
    makeDefaultNew: t('makeDefaultNew'),
    accounts: t('accounts'),
    captions: t('captions'),
    captionsHint: t('captionsHint'),
    presets: Object.fromEntries(CAPTION_PRESET_IDS.map((p) => [p, t(`presets.${p}`)])),
    phrases: t('phrases'),
    phrasesHint: t('phrasesHint'),
    forward: t('forward'),
    forwardHint: t('forwardHint'),
    backward: t('backward'),
    backwardHint: t('backwardHint'),
    onePerLine: t('onePerLine'),
    safe: t('safe'),
    safeOn: t('safeOn'),
    safeHint: t('safeHint'),
    timezone: t('timezone'),
    howOften: t('howOften'),
    safety: Object.fromEntries(SAFETY_IDS.map((s) => [s, t(`safety.${s}`)])),
    outro: t('outro'),
    outroOn: t('outroOn'),
    outroFree: t('outroFree'),
    logo: t('logo'),
    logoHint: t('logoHint'),
    logoStyle: t('logoStyle'),
    logoStylePh: t('logoStylePh'),
    logoGo: t('logoGo'),
    logoWorking: t('logoWorking'),
    logoAlt: t('logoAlt'),
    logoSaveFirst: t('logoSaveFirst'),
    logoFailed: t('logoFailed'),
    create: t('create'),
    save: t('save'),
    saved: t('saved'),
    makeDefault: t('makeDefault'),
    isDefault: t('isDefault'),
    remove: t('remove'),
    removeConfirm: t('removeConfirm'),
    working: t('working'),
    errors: await errorCopy(),
  };
}

export async function siteCopy(): Promise<SiteCopy> {
  const t = await getTranslations('clipsEngine.admin.site');
  return {
    es: t('es'),
    en: t('en'),
    hint: t('hint'),
    save: t('save'),
    saved: t('saved'),
    working: t('working'),
    errors: await errorCopy(),
  };
}

// Clips core methods over the engine's hub API: jobs (streams), the clip
// list, settings and capabilities. Owned by the Clips core workstream.
//
// Foundation: every engine-backed method throws NOT_IMPLEMENTED until its
// /api/hub/v1 endpoint lands (claude/hub-clips-core).

import 'server-only';
import { NotImplementedError } from '../tools';
import type { ClipsAdapter, ClipsCapabilities } from '../types';
import type { ClipsEngine } from './client';

export type CoreMethods = Pick<
  ClipsAdapter,
  | 'capabilities'
  | 'createJob'
  | 'getJob'
  | 'listJobs'
  | 'retryJob'
  | 'markSettled'
  | 'listClips'
  | 'getSettings'
  | 'saveSettings'
>;

export const ENGINE_CAPABILITIES: ClipsCapabilities = {
  sources: ['YouTube', 'Twitch', 'Kick'],
  bulkUpload: false,
  captionStyles: false,
  customDuration: false,
  watermark: false,
  fileUpload: false,
  supportsConnect: false,
  confirmsNoChargeOnFailure: true,
  editClips: false,
  framing: false,
  apiAccess: false,
};

const todo = (what: string) => () => {
  throw new NotImplementedError(`ClipsEngineAdapter.${what}`);
};

export function coreMethods(_engine: (userId: string) => ClipsEngine): CoreMethods {
  return {
    capabilities: () => ENGINE_CAPABILITIES,
    createJob: todo('createJob'),
    getJob: todo('getJob'),
    listJobs: todo('listJobs'),
    retryJob: todo('retryJob'),
    markSettled: todo('markSettled'),
    listClips: todo('listClips'),
    getSettings: todo('getSettings'),
    saveSettings: todo('saveSettings'),
  };
}

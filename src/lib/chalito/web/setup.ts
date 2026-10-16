import type { DeviceView, SessionView } from '@chalito/client';
import { setupChecklist, type SetupInput, type SetupState } from '@chalito/ui/setup';
import type { ConnStatus } from '@/lib/chalito/provider';
import { START_ADAPTERS } from './adapters';

/**
 * First Run D (ADR 0028 §6): the hub's side of the setup checklist. What each computer reported
 * (DeviceView.setup: pinned app ids, folder count and labels; never paths) plus this browser's
 * own state, into the shared pure checklist (@chalito/ui setup.ts). Pure: the screen is
 * SetupChecklist.tsx.
 */

const SESSION_APPS = new Set(START_ADAPTERS.map((a) => a.appId));

export interface SetupSources {
  status: ConnStatus;
  /** Signed in to the Chalyb account (the person's session, or this device's own). */
  signedIn: boolean;
  /** The directory says the account already has a computer (recovery instead of "Activar"). */
  needsRecovery: boolean;
  devices: readonly DeviceView[];
  sessions: readonly Pick<SessionView, 'sid'>[];
}

export const computersOf = (devices: readonly DeviceView[]) =>
  devices.filter((d) => d.role === 'agent' && !d.revoked);

export const setupInput = (s: SetupSources): SetupInput => ({
  signedIn: s.signedIn,
  deviceReady: s.status === 'ready',
  computers: computersOf(s.devices).map((d) => ({
    adapters: (d.setup?.adapters ?? []).filter((a) => SESSION_APPS.has(a)),
    workspaces: d.setup?.workspaces ?? 0,
  })),
  computerHint: s.needsRecovery,
  sessions: s.sessions.length,
});

export const setupState = (s: SetupSources): SetupState => setupChecklist(setupInput(s));

/** Where the ready-made first task runs: an online computer with a pinned app and a folder. */
export interface FirstTaskTarget {
  agentDeviceId: string;
  appId: string;
  workspaceLabel: string;
}

export const firstTaskTarget = (devices: readonly DeviceView[]): FirstTaskTarget | null => {
  const ready = computersOf(devices)
    .filter((d) => d.setup && d.setup.labels.length > 0)
    .sort((a, b) => Number(b.online) - Number(a.online));
  for (const d of ready) {
    // START_ADAPTERS is already in preference order (the four former providers first).
    const app = START_ADAPTERS.find((a) => d.setup!.adapters.includes(a.appId));
    if (app)
      return { agentDeviceId: d.deviceId, appId: app.appId, workspaceLabel: d.setup!.labels[0]! };
  }
  return null;
};

/** The checklist re-reads the computers this often while something is left (presence doesn't fan out). */
export const SETUP_RESYNC_MS = 15_000;

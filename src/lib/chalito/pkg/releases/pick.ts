import { DOWNLOAD_OSES, ReleaseManifest, type Channel, type DownloadOs } from "./manifest";
import type { DetectedPlatform } from "./detect";

type DownloadFile = NonNullable<NonNullable<ReleaseManifest["downloads"]>[DownloadOs]>[number];

/**
 * One channel's manifest through the api (which returns signed, short-lived URLs).
 * Null when there's no release on that channel yet, or the manifest is malformed.
 */
export const fetchChannel = async (
  apiBase: string,
  channel: Channel,
  f: typeof fetch = fetch,
): Promise<ReleaseManifest | null> => {
  try {
    const res = await f(`${apiBase.replace(/\/+$/, "")}/releases/${channel}/latest.json`, { credentials: "omit" });
    if (!res.ok) return null;
    const m = ReleaseManifest.safeParse(await res.json());
    return m.success ? m.data : null;
  } catch {
    return null;
  }
};

/** Stable first; until there's a stable release, the beta (ADR 0028: the first releases are beta). */
export const loadManifest = async (
  apiBase: string,
  f: typeof fetch = fetch,
): Promise<{ manifest: ReleaseManifest; channel: Channel } | null> => {
  for (const channel of ["stable", "beta"] as const) {
    const manifest = await fetchChannel(apiBase, channel, f);
    if (manifest) return { manifest, channel };
  }
  return null;
};

/** The installer offered first for each OS: the one most people on it can just open. */
const PREFERRED: Record<DownloadOs, string[]> = {
  windows: ["nsis"],
  macos: ["dmg"],
  linux: ["appimage", "deb", "rpm"],
};

export interface DownloadPick {
  os: DownloadOs;
  /** The one big button. Null when this OS has no file in the manifest. */
  primary: DownloadFile | null;
  /** The same OS's other formats (deb and rpm next to the AppImage). */
  others: DownloadFile[];
  /** The other systems, offered below the main button. */
  otherOses: DownloadOs[];
}

/**
 * What /descargar shows: the detected OS's preferred installer as the one main button, its other
 * formats under it, and the other systems below. `chosen` is the person's own switch.
 */
export const pickDownloads = (
  manifest: ReleaseManifest,
  detected: DetectedPlatform,
  chosen: DownloadOs | null,
): DownloadPick => {
  const desktop = (DOWNLOAD_OSES as readonly string[]).includes(detected) ? (detected as DownloadOs) : null;
  const os: DownloadOs = chosen ?? desktop ?? "windows";
  const files = [...(manifest.downloads?.[os] ?? [])];
  const rank = (k: string) => {
    const i = PREFERRED[os].indexOf(k);
    return i < 0 ? PREFERRED[os].length : i;
  };
  files.sort((a, b) => rank(a.kind) - rank(b.kind));
  return {
    os,
    primary: files[0] ?? null,
    others: files.slice(1),
    otherOses: DOWNLOAD_OSES.filter((o) => o !== os),
  };
};

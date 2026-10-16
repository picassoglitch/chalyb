import { DOWNLOAD_OSES, ReleaseManifest, type Channel, type DownloadOs } from "./manifest";
import type { DetectedPlatform } from "./detect";

type DownloadFile = NonNullable<NonNullable<ReleaseManifest["downloads"]>[DownloadOs]>[number];

/** One channel's manifest: there, not published (404), or unknown (network, server, malformed). */
export type ChannelResult = { status: "ok"; manifest: ReleaseManifest } | { status: "none" } | { status: "error" };

/** One channel's manifest through the api (which returns signed, short-lived URLs). */
export const fetchChannelResult = async (
  apiBase: string,
  channel: Channel,
  f: typeof fetch = fetch,
): Promise<ChannelResult> => {
  try {
    const res = await f(`${apiBase.replace(/\/+$/, "")}/releases/${channel}/latest.json`, { credentials: "omit" });
    if (res.status === 404) return { status: "none" };
    if (!res.ok) return { status: "error" };
    const m = ReleaseManifest.safeParse(await res.json());
    return m.success ? { status: "ok", manifest: m.data } : { status: "error" };
  } catch {
    return { status: "error" };
  }
};

/** The manifest or null (no release, or it couldn't be read). */
export const fetchChannel = async (
  apiBase: string,
  channel: Channel,
  f: typeof fetch = fetch,
): Promise<ReleaseManifest | null> => {
  const r = await fetchChannelResult(apiBase, channel, f);
  return r.status === "ok" ? r.manifest : null;
};

export type LoadResult =
  | { status: "ok"; manifest: ReleaseManifest; channel: Channel }
  | { status: "none" }
  | { status: "error" };

/**
 * Stable first; only when stable has no release at all (404), the beta (ADR 0028: the first
 * releases are beta). A stable that can't be read right now is an error, never a reason to offer
 * the beta instead: the page shows a retry.
 */
export const loadManifest = async (apiBase: string, f: typeof fetch = fetch): Promise<LoadResult> => {
  const stable = await fetchChannelResult(apiBase, "stable", f);
  if (stable.status === "ok") return { status: "ok", manifest: stable.manifest, channel: "stable" };
  if (stable.status === "error") return stable;
  const beta = await fetchChannelResult(apiBase, "beta", f);
  return beta.status === "ok" ? { status: "ok", manifest: beta.manifest, channel: "beta" } : beta;
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

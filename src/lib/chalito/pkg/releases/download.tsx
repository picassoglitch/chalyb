import { useEffect, useState } from "react";
import type { Channel, DownloadOs, ReleaseManifest } from "./manifest";
import { fetchChannel, pickDownloads } from "./pick";
import { detectPlatform, type DetectedPlatform, type NavigatorLike } from "./detect";

/** `t(key, values)` over this package's messages (es/en), e.g. next-intl's `useTranslations("download")`. */
export type DownloadText = (key: string, values?: Record<string, string | number>) => string;

/** One channel's manifest (kept for callers that ask for a specific channel). */
export const fetchManifest = (apiBase: string, channel: Channel = "stable", f: typeof fetch = fetch) =>
  fetchChannel(apiBase, channel, f);

/**
 * /descargar: the detected OS's installer as one main button, its other formats under it, and the
 * other systems below. Shows the version, sizes and SHA-256 checksums, an unsigned warning when
 * the build wasn't signed, and the SmartScreen steps for an unsigned Windows build (ADR 0014,
 * ADR 0028 §A). `manifest` undefined = still loading; null = no release yet.
 */
export const DownloadPanel = ({
  manifest,
  channel = "stable",
  t,
  navigator: nav = typeof navigator === "undefined" ? undefined : (navigator as NavigatorLike),
}: {
  manifest: ReleaseManifest | null | undefined;
  channel?: Channel;
  t: DownloadText;
  navigator?: NavigatorLike;
}) => {
  const [detected, setDetected] = useState<DetectedPlatform>("unknown");
  const [chosen, setChosen] = useState<DownloadOs | null>(null);
  // Detection runs on the client only (no hydration mismatch when the page is server-rendered).
  useEffect(() => setDetected(detectPlatform(nav)), [nav]);

  if (manifest === undefined) return <p>{t("loading")}</p>;
  if (manifest === null) return <p role="status">{t("unavailable")}</p>;
  const { os, primary, others, otherOses } = pickDownloads(manifest, detected, chosen);
  const unsigned = Boolean(manifest.unsigned?.[os]);
  const desktop = detected === os && chosen === null;

  return (
    <section data-download-os={os} className="ch-chl">
      <h2 className="ch-h2">{t("title")}</h2>
      {desktop && <p className="ch-sub">{t("detected", { os: t(`os.${os}`) })}</p>}
      {(detected === "ios" || detected === "android") && (
        <p role="note" className="ch-card ch-chl-card ch-chl-card--warn">
          {t("mobile")}
        </p>
      )}
      {primary ? (
        <div className="ch-card ch-chl-card" data-kind={primary.kind} data-primary>
          <a href={primary.url} download={primary.name} rel="noopener" className="ch-btn ch-btn--primary ch-btn--xl">
            {t("primary", { os: t(`os.${os}`) })}
          </a>
          <span className="ch-chl-small">
            {t(`kinds.${primary.kind}`)} · {primary.name} · {t("size", { mb: (primary.size / 1_048_576).toFixed(1) })}
          </span>
          <code className="ch-chl-mono ch-chl-small" title={t("checksum")}>
            {t("checksum")} {primary.sha256}
          </code>
        </div>
      ) : (
        <p role="status">{t("unavailable")}</p>
      )}
      <p className="ch-chl-small">
        {t("version", { version: manifest.version })}
        {channel === "beta" ? ` · ${t("beta")}` : ""}
      </p>
      {unsigned && os === "windows" ? (
        <div role="note" data-unsigned data-smartscreen className="ch-card ch-chl-card ch-chl-card--warn">
          <p>{t("smartscreen")}</p>
          <ol className="ch-chl-bullets">
            <li>{t("smartscreenSteps.one")}</li>
            <li>{t("smartscreenSteps.two")}</li>
          </ol>
        </div>
      ) : unsigned ? (
        <p role="note" data-unsigned className="ch-card ch-chl-card ch-chl-card--warn">
          {t("unsigned")}
        </p>
      ) : null}
      {primary && <p className="ch-chl-small">{t("next")}</p>}
      {others.length > 0 && (
        <>
          <h3 className="ch-chl-h3">{t("others")}</h3>
          <ul className="ch-chl-list">
            {others.map((f) => (
              <li key={f.name} data-kind={f.kind} className="ch-card ch-chl-card">
                <a href={f.url} download={f.name} rel="noopener" className="ch-btn ch-btn--secondary ch-chl-fit">
                  {t(`kinds.${f.kind}`)}
                </a>
                <span className="ch-chl-small">
                  {f.name} · {t("size", { mb: (f.size / 1_048_576).toFixed(1) })}
                </span>
                <code className="ch-chl-mono ch-chl-small" title={t("checksum")}>
                  {f.sha256}
                </code>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="ch-chl-small">{t("otherOs")}</p>
      <div role="group" aria-label={t("choose")} className="ch-chl-row">
        {otherOses.map((o) => (
          <button key={o} type="button" className="ch-chip ch-chip--sm" onClick={() => setChosen(o)}>
            {t(`os.${o}`)}
          </button>
        ))}
      </div>
    </section>
  );
};

"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Download as DownloadIcon, WifiOff } from "lucide-react";
import { DownloadPanel } from "@chalito/releases/download";
import { loadManifest } from "@chalito/releases/pick";
import type { Channel, ReleaseManifest } from "@chalito/releases";
import { env } from "@/lib/chalito/web/env";
import { Empty } from "./Empty";

/**
 * Only signed https links are offered: the api swaps the manifest's bucket paths for short-lived
 * signed URLs, so anything else (a raw path, another scheme) is a broken or tampered manifest.
 */
export const httpsOnly = (m: ReleaseManifest | null): ReleaseManifest | null => {
  if (!m?.downloads) return m;
  const downloads = Object.fromEntries(
    Object.entries(m.downloads).map(([os, files]) => [os, (files ?? []).filter((f) => /^https:\/\//.test(f.url))]),
  ) as ReleaseManifest["downloads"];
  return { ...m, downloads };
};

/**
 * /descargar: the desktop apps from the release manifest (@chalito/releases, ADR 0014). Stable
 * first, else the beta; with no release at all, a friendly "Muy pronto" with a way forward
 * instead of a dead end; when the manifest can't be read right now, a retry (ADR 0028 §A).
 */
export const Download = () => {
  const t = useTranslations("chalito.download");
  type State = { manifest: ReleaseManifest; channel: Channel } | "none" | "error" | undefined;
  const [state, setState] = useState<State>(undefined);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    void loadManifest(env.apiBase).then((r) => {
      if (!alive) return;
      if (r.status !== "ok") return setState(r.status);
      const manifest = httpsOnly(r.manifest);
      setState(manifest ? { manifest, channel: r.channel } : "error");
    });
    return () => {
      alive = false;
    };
  }, [attempt]);
  const retry = () => {
    setState(undefined);
    setAttempt((n) => n + 1);
  };
  return (
    <div data-testid="download">
      {state === "none" ? (
        <Empty
          icon={<DownloadIcon />}
          title={t("soonTitle")}
          body={t("soonBody")}
          action={{ href: "/inicio", label: t("soonAction") }}
          testId="download-soon"
        />
      ) : state === "error" ? (
        <div className="ch-card ch-state" role="alert" data-testid="download-error">
          <span className="ch-state__ic" aria-hidden="true">
            <WifiOff />
          </span>
          <p className="ch-chl-h3">{t("errorTitle")}</p>
          <p className="ch-muted">{t("errorBody")}</p>
          <button type="button" className="ch-btn ch-btn--primary" onClick={retry}>
            {t("retry")}
          </button>
        </div>
      ) : (
        <DownloadPanel manifest={state?.manifest} channel={state?.channel} t={(k, v) => t(k, v)} />
      )}
    </div>
  );
};

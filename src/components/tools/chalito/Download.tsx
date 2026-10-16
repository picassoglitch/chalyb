"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Download as DownloadIcon } from "lucide-react";
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
 * instead of a dead end (ADR 0028 §A).
 */
export const Download = () => {
  const t = useTranslations("chalito.download");
  const [state, setState] = useState<{ manifest: ReleaseManifest; channel: Channel } | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void loadManifest(env.apiBase).then((r) => {
      if (!alive) return;
      const manifest = httpsOnly(r?.manifest ?? null);
      setState(r && manifest ? { manifest, channel: r.channel } : null);
    });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div data-testid="download">
      {state === null ? (
        <Empty
          icon={<DownloadIcon />}
          title={t("soonTitle")}
          body={t("soonBody")}
          action={{ href: "/inicio", label: t("soonAction") }}
          testId="download-soon"
        />
      ) : (
        <DownloadPanel manifest={state?.manifest} channel={state?.channel} t={(k, v) => t(k, v)} />
      )}
    </div>
  );
};

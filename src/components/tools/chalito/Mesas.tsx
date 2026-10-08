"use client";
import { useEffect, useState } from "react";
import type { Route } from "next";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { MesaList, NewMesaForm, type BrainProvider, type LinkLike, type NewMesaInput } from "@chalito/ui";
import { listMesas, type CreateParticipant, type MesaSummary } from "@chalito/client";
import { getPathname, useRouter } from "@/lib/chalito/navigation";
import { brainName, safeName } from "@/lib/chalito/web/mesa";
import { useChalito, useLive } from "@/lib/chalito/provider";

export const NextLinkLike: LinkLike = ({ href, className, children, ...rest }) => (
  // hrefs here are already locale-resolved paths (getPathname); the hub builds with typedRoutes.
  <NextLink href={href as Route} className={className} {...rest}>
    {children}
  </NextLink>
);

/** Sessions that may sit at a Mesa as references: the live ones (not ended). */
const ENDED = new Set(["ended", "failed", "stopped", "exited"]);

/** /m: the person's Mesas and "Nueva Mesa". */
export const Mesas = () => {
  const t = useTranslations("chalito.settings.mesa");
  const ti = useTranslations("chalito.integrations");
  const locale = useLocale() as "es" | "en";
  const router = useRouter();
  const { mesa, readCompanion, settings } = useChalito();
  const live = useLive();
  const [list, setList] = useState<MesaSummary[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [companion, setCompanion] = useState<{ id: string; name: string } | null | undefined>(undefined);
  const [limit, setLimit] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mesa) return;
    let alive = true;
    void listMesas(mesa.db)
      .then((l) => alive && setList(l))
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, [mesa]);

  useEffect(() => {
    if (!readCompanion) return;
    let alive = true;
    void (async () => {
      const c = await readCompanion();
      const name = await settings
        ?.load()
        .then((r) => r.values.companionName.name)
        .catch(() => "");
      if (alive) setCompanion(c && c !== "error" ? { id: c.companionId, name: safeName(name ?? "", "Chalito") } : null);
    })();
    return () => {
      alive = false;
    };
  }, [readCompanion, settings]);

  if (!mesa || companion === undefined) return <p aria-live="polite">…</p>;

  const sessions = live.sessions
    .filter((s) => !ENDED.has(s.state ?? ""))
    .map((s) => ({ sid: s.sid, label: s.label || s.card?.label || s.sid }));
  const providerLabel = (p: BrainProvider) => ti(`${p}.name`);

  const create = async (input: NewMesaInput) => {
    setBusy(true);
    setError(null);
    const participants: CreateParticipant[] = [
      ...(input.companion && companion
        ? [{ kind: "companion" as const, pid: "companion", name: companion.name, companionId: companion.id }]
        : []),
      ...input.brains.map((p) => ({
        kind: "brain" as const,
        pid: p,
        name: brainName(providerLabel(p), p),
        provider: p,
      })),
      ...input.sessions.map((sid, i) => {
        const s = sessions.find((x) => x.sid === sid);
        return {
          kind: "session" as const,
          pid: `session${i + 1}`,
          name: safeName(s?.label ?? "", `Sesión ${i + 1}`),
          sid,
        };
      }),
    ];
    const r = await mesa.api.create(participants, t("you"));
    setBusy(false);
    if (!r.ok) {
      if (r.error === "mesa_brains_limit") {
        const n = typeof r.limit === "number" ? r.limit : 0;
        setLimit(n);
        return setError(n > 0 ? t("new.errors.mesa_brains_limit", { n }) : t("new.errors.mesa_brains_none"));
      }
      return setError(t.has(`new.errors.${r.error}`) ? t(`new.errors.${r.error}`) : t("new.errors.error"));
    }
    await mesa.state.set(r.mid, { goal: input.goal, card: null });
    router.push({ pathname: "/m/[id]", params: { id: r.mid } });
  };

  return (
    <div className="ch-chl" data-testid="mesas">
      <header className="ch-chl-head">
        <h2 className="ch-h2">{t("title")}</h2>
        <p className="ch-sub">{t("intro")}</p>
      </header>
      <NewMesaForm
        companionName={companion?.name ?? null}
        sessions={sessions}
        brainLimit={limit}
        providerLabel={providerLabel}
        busy={busy}
        error={error}
        onCreate={(i) => void create(i)}
      />
      <section className="ch-chl ch-chl--tight">
        <h3 className="ch-ghead">{t("list")}</h3>
        {loadError ? (
          <p role="alert">{t("errors.load")}</p>
        ) : list === null ? (
          <p aria-live="polite">…</p>
        ) : (
          <MesaList
            mesas={list}
            hrefOf={(id) => getPathname({ href: { pathname: "/m/[id]", params: { id } }, locale })}
            Link={NextLinkLike}
          />
        )}
      </section>
    </div>
  );
};

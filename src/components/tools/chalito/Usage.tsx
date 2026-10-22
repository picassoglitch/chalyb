"use client";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Usage as UsageData, UsageDay } from "@/lib/chalito/web/usage";
import { useChalito } from "@/lib/chalito/provider";
import { Loading } from "./Loading";
import { intlLocale, tokenFormat } from "@/lib/chalito/format";

const RANGES = [7, 30] as const;
type Range = (typeof RANGES)[number];

const H = 120;

/** Stacked daily bars (SVG; no chart library). `parts` are drawn bottom-up. */
const Bars = ({
  days,
  parts,
  label,
  testId,
}: {
  days: UsageDay[];
  parts: { value: (d: UsageDay) => number; className: string }[];
  label: string;
  testId: string;
}) => {
  const max = Math.max(1, ...days.map((d) => parts.reduce((a, p) => a + p.value(d), 0)));
  const w = 100 / days.length;
  return (
    <svg
      viewBox={`0 0 100 ${H}`}
      preserveAspectRatio="none"
      className="ch-chl-chart"
      role="img"
      aria-label={label}
      data-testid={testId}
    >
      {days.map((d, i) => {
        let y = H;
        return (
          <g key={d.day} data-day={d.day}>
            {parts.map((p, j) => {
              const h = (p.value(d) / max) * (H - 4);
              y -= h;
              return h > 0 ? (
                <rect key={j} x={i * w + w * 0.15} y={y} width={w * 0.7} height={h} className={p.className} />
              ) : null;
            })}
          </g>
        );
      })}
    </svg>
  );
};

/** Communication's daily share with the target as a dashed line. The scale tops out at 2× the target. */
const ShareChart = ({ days, target, label }: { days: UsageDay[]; target: number; label: string }) => {
  const top = Math.max(target * 2, ...days.map((d) => d.commsShare ?? 0));
  const w = 100 / days.length;
  const y = (v: number) => H - (v / top) * (H - 4);
  return (
    <svg
      viewBox={`0 0 100 ${H}`}
      preserveAspectRatio="none"
      className="ch-chl-chart ch-chl-chart--short"
      role="img"
      aria-label={label}
      data-testid="usage-share-chart"
    >
      {days.map((d, i) =>
        d.commsShare === null ? null : (
          <rect
            key={d.day}
            x={i * w + w * 0.15}
            y={y(d.commsShare)}
            width={w * 0.7}
            height={H - y(d.commsShare)}
            className={d.commsShare > target ? "ch-chl-fill--over" : "ch-chl-fill--comms"}
          />
        ),
      )}
      <line
        x1={0}
        x2={100}
        y1={y(target)}
        y2={y(target)}
        className="ch-chl-stroke--target"
        strokeWidth={0.6}
        strokeDasharray="2 1.5"
        vectorEffect="non-scaling-stroke"
        data-testid="usage-target-line"
      />
    </svg>
  );
};

/**
 * /uso: how many tokens Chalito used, per day. "Trabajo" is the work itself; "Comunicación" is
 * what it costs to keep you informed (briefs, messages, calls), which should stay under the
 * target share. "Tus claves" (your own provider keys) is shown apart: it uses no Chalito tokens.
 * Tokens only, never money: the hub sells tokens.
 */
export const Usage = () => {
  const t = useTranslations("chalito.usage");
  const locale = useLocale();
  const { usage } = useChalito();
  const [range, setRange] = useState<Range>(30);
  const [data, setData] = useState<UsageData | "error" | null>(null);

  const load = useCallback(() => {
    if (!usage) return () => undefined;
    let alive = true;
    setData(null);
    void usage(range).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [usage, range]);
  useEffect(load, [load]);

  const n = tokenFormat(locale);
  const compact = new Intl.NumberFormat(intlLocale(locale), { notation: "compact", maximumFractionDigits: 1 });
  const pct = new Intl.NumberFormat(intlLocale(locale), { style: "percent", maximumFractionDigits: 1 });
  const dayLabel = (d: string) =>
    new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(d));

  const head = (
    <div className="ch-chl-row ch-chl-row--between">
      <h2 className="ch-h2">{t("title")}</h2>
      <div className="ch-chl-row" role="group" aria-label={t("range")}>
        {RANGES.map((r) => (
          <button
            key={r}
            aria-pressed={range === r}
            data-testid={`usage-range-${r}`}
            className={`ch-chip ch-chip--sm${range === r ? " ch-chip--on" : ""}`}
            onClick={() => setRange(r)}
          >
            {t("days", { n: r })}
          </button>
        ))}
      </div>
    </div>
  );

  if (data === null)
    return (
      <div className="ch-chl">
        {head}
        <Loading label={t("loading")} rows={2} />
      </div>
    );
  if (data === "error")
    return (
      <div className="ch-chl">
        {head}
        <div role="alert" data-testid="usage-error" className="ch-card ch-chl-card ch-chl-card--bad ch-chl-bad">
          <p>{t("error")}</p>
          <button className="ch-btn ch-btn--danger ch-btn--compact ch-chl-fit" onClick={() => load()}>
            {t("retry")}
          </button>
        </div>
      </div>
    );

  const work = data.days.reduce((a, d) => a + d.managed.work.tokens, 0);
  const comms = data.days.reduce((a, d) => a + d.managed.comms.tokens, 0);
  const ratio = data.commsOverheadRatio;
  const over = ratio !== null && ratio > data.target;
  const empty = data.totals.managedTokens === 0 && data.totals.byoTokens === 0;

  return (
    <div className="ch-chl" data-testid="usage">
      {head}
      <p className="ch-sub">{t("intro")}</p>
      {empty ? (
        <p data-testid="usage-empty" className="ch-card ch-chl-card">
          {t("empty")}
        </p>
      ) : null}

      <section className="ch-card ch-chl-card" aria-labelledby="usage-chalito">
        <h3 id="usage-chalito" className="ch-ghead">
          {t("chalito.title")}
        </h3>
        <p className="ch-kpi__v" data-testid="usage-managed-total">
          {t("tokens", { n: n.format(data.totals.managedTokens) })}
        </p>
        <ul className="ch-chl-row ch-chl-small">
          <li className="ch-chl-row">
            <span aria-hidden className="ch-chl-swatch ch-chl-swatch--work" />
            {t("chalito.work")}: <span data-testid="usage-work">{n.format(work)}</span>
          </li>
          <li className="ch-chl-row">
            <span aria-hidden className="ch-chl-swatch ch-chl-swatch--comms" />
            {t("chalito.comms")}: <span data-testid="usage-comms">{n.format(comms)}</span>
          </li>
        </ul>
        <Bars
          days={data.days}
          testId="usage-managed-chart"
          label={t("chalito.chartLabel", { days: data.days.length })}
          parts={[
            { value: (d) => d.managed.work.tokens, className: "ch-chl-fill--work" },
            { value: (d) => d.managed.comms.tokens, className: "ch-chl-fill--comms" },
          ]}
        />
        <div className="ch-chl-row ch-chl-row--between ch-chl-small" aria-hidden>
          <span>{data.days[0] ? dayLabel(data.days[0].day) : ""}</span>
          <span>{data.days.at(-1) ? dayLabel(data.days.at(-1)!.day) : ""}</span>
        </div>
      </section>

      <section className="ch-card ch-chl-card" aria-labelledby="usage-share">
        <h3 id="usage-share" className="ch-ghead">
          {t("share.title")}
        </h3>
        {ratio === null ? (
          <p className="ch-muted">{t("share.none")}</p>
        ) : (
          <>
            <p data-testid="usage-share" data-over={over}>
              {t("share.value", { share: pct.format(ratio), target: pct.format(data.target) })}
            </p>
            <div
              className="ch-chl-meter"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(ratio * 1000) / 10}
              aria-label={t("share.title")}
            >
              <div
                className={`ch-chl-meter__bar${over ? " ch-chl-meter__bar--over" : ""}`}
                style={{ width: `${Math.min(100, (ratio / (data.target * 2)) * 100)}%` }}
              />
              {/* The target sits at the middle: the meter's scale is twice the target. */}
              <div aria-hidden className="ch-chl-meter__target" />
            </div>
            <p className={`ch-chl-small${over ? " ch-chl-warn" : ""}`} role={over ? "note" : undefined}>
              {over ? t("share.over") : t("share.under")}
            </p>
            <ShareChart
              days={data.days}
              target={data.target}
              label={t("share.chartLabel", { target: pct.format(data.target) })}
            />
          </>
        )}
      </section>

      <section className="ch-card ch-chl-card" aria-labelledby="usage-byo">
        <h3 id="usage-byo" className="ch-ghead">
          {t("byo.title")}
        </h3>
        <p className="ch-muted">{t("byo.body")}</p>
        <p className="ch-kpi__v" data-testid="usage-byo-total">
          {t("tokens", { n: n.format(data.totals.byoTokens) })}
        </p>
        {data.totals.byoTokens > 0 ? (
          <Bars
            days={data.days}
            testId="usage-byo-chart"
            label={t("byo.chartLabel", { days: data.days.length })}
            parts={[{ value: (d) => d.byo.tokens, className: "ch-chl-fill--byo" }]}
          />
        ) : null}
      </section>

      <details className="ch-card ch-adv">
        <summary>{t("table.title")}</summary>
        <div className="ch-adv__body">
          <div className="ch-table-wrap">
            <table className="ch-table" data-testid="usage-table">
              <thead>
                <tr>
                  <th>{t("table.day")}</th>
                  <th className="num">{t("chalito.work")}</th>
                  <th className="num">{t("chalito.comms")}</th>
                  <th className="num">{t("byo.title")}</th>
                </tr>
              </thead>
              <tbody>
                {[...data.days].reverse().map((d) => (
                  <tr key={d.day}>
                    <td>{dayLabel(d.day)}</td>
                    <td className="num">{compact.format(d.managed.work.tokens)}</td>
                    <td className="num">{compact.format(d.managed.comms.tokens)}</td>
                    <td className="num">{compact.format(d.byo.tokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </div>
  );
};

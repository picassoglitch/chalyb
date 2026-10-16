'use client';

// Piloto automático: new clips publish themselves (hands-free) or on "Ship",
// to the chosen networks, under a daily cap, with the person's signature —
// plus "Publicación inteligente", the per-network rulebook.

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Save } from 'lucide-react';
import { publishApi, usePublishErrorText } from './api';
import { InlineMsg, PlatformTile, platformName, type Msg } from './common';

interface Settings {
  enabled: boolean;
  mode: 'on_approve' | 'hands_free';
  targets: string | null;
  post_mode: 'queue' | 'now';
  daily_cap: number | null;
  score_threshold: number | null;
  tag_suffix: string | null;
  growth_min_score: number | null;
  daily_clip_budget: number | null;
}

interface Rule {
  platform: string;
  max_per_day: number;
  min_gap_minutes: number;
  hashtag_max: number;
  enabled: boolean;
  overridden: boolean;
}

const bucket = (thr: number | null) =>
  thr === null ? '0.6' : thr <= 0.45 ? '0.3' : thr >= 0.7 ? '0.8' : '0.6';

export function AutopilotTab() {
  const t = useTranslations('clipsPublish.autopilot');
  const tc = useTranslations('consents.autopublish');
  const locale = useLocale();
  const errText = usePublishErrorText();
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [wasEnabled, setWasEnabled] = useState(false);
  const [consent, setConsent] = useState(false);
  const [mode, setMode] = useState<'on_approve' | 'hands_free'>('hands_free');
  const [postMode, setPostMode] = useState<'queue' | 'now'>('queue');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [targets, setTargets] = useState<string[]>([]);
  const [cap, setCap] = useState('10');
  const [threshold, setThreshold] = useState('0.6');
  const [suffix, setSuffix] = useState('');
  const [budget, setBudget] = useState('');
  const [growthMin, setGrowthMin] = useState('40');
  const [usedToday, setUsedToday] = useState(0);
  const [savedCap, setSavedCap] = useState<number | null>(10);
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [ruleMsg, setRuleMsg] = useState<Msg>(null);

  function load() {
    return publishApi<{ settings: Settings; platforms: string[]; used_today: number }>(
      'autopublish.json',
    ).then((r) => {
      if (!r.ok) {
        setLoadErr(errText(r.error));
        return;
      }
      const s = r.data.settings;
      setEnabled(!!s.enabled);
      setWasEnabled(!!s.enabled);
      setConsent(false);
      setMode(s.mode || 'hands_free');
      setPostMode(s.post_mode || 'queue');
      setPlatforms(r.data.platforms ?? []);
      setTargets((s.targets ?? '').split(',').filter(Boolean));
      setCap(String(s.daily_cap ?? 10));
      setSavedCap(s.daily_cap ?? null);
      setThreshold(bucket(s.score_threshold));
      setSuffix(s.tag_suffix ?? '');
      setBudget(s.daily_clip_budget == null ? '' : String(s.daily_clip_budget));
      setGrowthMin(String(s.growth_min_score ?? 40));
      setUsedToday(r.data.used_today ?? 0);
      setLoaded(true);
    });
  }
  function loadRules() {
    return publishApi<{ rules: Rule[] }>('autopublish/rules.json').then((r) => {
      setRules(r.ok ? (r.data.rules ?? []) : []);
    });
  }
  useEffect(() => {
    void load();
    void loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once
  }, []);

  if (loadErr) return <p className="ch-pub-err">{loadErr}</p>;
  if (!loaded) return <p className="ch-pub-hint">{t('loading')}</p>;

  return (
    <section className="ch-card ch-pub-sec" aria-labelledby="pub-ap-h">
      <header>
        <h2 id="pub-ap-h">{t('title')}</h2>
        <span className="ch-pub__push ch-pub-hint">{t('tagline')}</span>
      </header>
      <label className="ch-pub-check">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span>
          <b>{t('enable')}</b>
          <br />
          <span className="ch-pub-hint">{t('enableHint')}</span>
        </span>
      </label>
      {enabled && !wasEnabled && (
        <label className="ch-check">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            {tc.rich('check', {
              cuenta: targets.length ? targets.map(platformName).join(', ') : t('allNetworks'),
              b: (c) => <b>{c}</b>,
            })}
          </span>
        </label>
      )}

      <fieldset className="ch-pub-stack" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 650, marginBottom: 8 }}>{t('q1')}</legend>
        <label className="ch-pub-check">
          <input
            type="radio"
            name="pub-ap-mode"
            checked={mode === 'hands_free'}
            onChange={() => setMode('hands_free')}
          />
          <span>
            <b>{t('handsFree')}</b> <span className="ch-pub-hint">{t('handsFreeHint')}</span>
          </span>
        </label>
        <label className="ch-pub-check">
          <input
            type="radio"
            name="pub-ap-mode"
            checked={mode === 'on_approve'}
            onChange={() => setMode('on_approve')}
          />
          <span>
            <b>{t('onApprove')}</b> <span className="ch-pub-hint">{t('onApproveHint')}</span>
          </span>
        </label>
      </fieldset>

      <label className="ch-pub-field" style={{ maxWidth: 380 }}>
        <span>{t('q2')}</span>
        <select
          className="ch-select"
          value={postMode}
          onChange={(e) => setPostMode(e.target.value as 'queue' | 'now')}
        >
          <option value="queue">{t('postQueue')}</option>
          <option value="now">{t('postNow')}</option>
        </select>
        <small>{t('q2Hint')}</small>
      </label>

      <div className="ch-pub-field">
        <span id="pub-ap-targets">{t('q3')}</span>
        {platforms.length === 0 ? (
          <small>{t('noTargets')}</small>
        ) : (
          <div className="ch-pub-chips" role="group" aria-labelledby="pub-ap-targets">
            {platforms.map((p) => (
              <button
                key={p}
                type="button"
                className="ch-pub-chip"
                aria-pressed={targets.includes(p)}
                onClick={() =>
                  setTargets((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]))
                }
              >
                <PlatformTile id={p} small />
                {platformName(p)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ch-pub-fields">
        <label className="ch-pub-field">
          <span>{t('q4')}</span>
          <small>{t('q4Hint')}</small>
          <input
            className="ch-input ch-pub-num"
            type="number"
            min={0}
            value={cap}
            onChange={(e) => setCap(e.target.value)}
          />
        </label>
        <label className="ch-pub-field">
          <span>{t('q5')}</span>
          <small>{t('q5Hint')}</small>
          <select
            className="ch-select"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          >
            <option value="0.3">{t('thrAll')}</option>
            <option value="0.6">{t('thrGood')}</option>
            <option value="0.8">{t('thrBest')}</option>
          </select>
        </label>
      </div>
      <p className="ch-pub-hint">
        {savedCap ? t('usedOf', { n: usedToday, cap: savedCap }) : t('used', { n: usedToday })}
      </p>
      <label className="ch-pub-field">
        <span>{t('q6')}</span>
        <small>{t('q6Hint')}</small>
        <textarea
          className="ch-input"
          rows={2}
          maxLength={500}
          value={suffix}
          placeholder={t('q6Placeholder')}
          onChange={(e) => setSuffix(e.target.value)}
        />
      </label>

      <div className="ch-pub-stack" style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
        <div>
          <b>{t('smartTitle')}</b>
          <p className="ch-pub-hint">{t('smartBody')}</p>
        </div>
        <div className="ch-pub-fields">
          <label className="ch-pub-field">
            <span>{t('budget')}</span>
            <small>{t('budgetHint')}</small>
            <input
              className="ch-input ch-pub-num"
              style={{ width: 120 }}
              type="number"
              min={0}
              value={budget}
              placeholder={t('budgetPlaceholder')}
              onChange={(e) => setBudget(e.target.value)}
            />
          </label>
          <label className="ch-pub-field">
            <span>{t('growthMin')}</span>
            <small>{t('growthMinHint')}</small>
            <input
              className="ch-input ch-pub-num"
              type="number"
              min={0}
              max={100}
              value={growthMin}
              onChange={(e) => setGrowthMin(e.target.value)}
            />
          </label>
        </div>
        <div className="ch-pub-stack">
          <b>{t('rulesTitle')}</b>
          <p className="ch-pub-hint">{t('rulesHint')}</p>
          <InlineMsg msg={ruleMsg} />
          {rules === null ? (
            <p className="ch-pub-hint">{t('loading')}</p>
          ) : rules.length === 0 ? (
            <p className="ch-pub-hint">{t('noRules')}</p>
          ) : (
            <div className="ch-table-wrap" tabIndex={0} aria-label={t('rulesTitle')}>
              <table className="ch-table">
                <thead>
                  <tr>
                    <th>{t('col.platform')}</th>
                    <th>{t('col.max')}</th>
                    <th>{t('col.gap')}</th>
                    <th>{t('col.tags')}</th>
                    <th>{t('col.on')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <RuleRow
                      key={r.platform}
                      rule={r}
                      onSaved={async (m) => {
                        setRuleMsg(m);
                        await loadRules();
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="ch-pub-row">
        <button
          type="button"
          className="ch-btn ch-btn--primary ch-btn--compact"
          onClick={async () => {
            if (enabled && !wasEnabled && !consent) {
              setMsg({ kind: 'bad', text: t('needConsent') });
              return;
            }
            setMsg({ kind: 'info', text: t('saving') });
            const r = await publishApi('autopublish/save', {
              body: {
                consent,
                locale,
                enabled,
                mode,
                targets,
                post_mode: postMode,
                daily_cap: parseInt(cap, 10) || 0,
                score_threshold: parseFloat(threshold) || 0,
                tag_suffix: suffix,
                growth_min_score: parseInt(growthMin, 10) || 0,
                daily_clip_budget: budget || null,
              },
            });
            if (!r.ok) {
              setMsg({ kind: 'bad', text: errText(r.error) });
              return;
            }
            setMsg({ kind: 'ok', text: t('saved') });
            await load();
          }}
        >
          <Save aria-hidden="true" />
          {t('save')}
        </button>
        <InlineMsg msg={msg} />
      </div>
    </section>
  );
}

function RuleRow({ rule, onSaved }: { rule: Rule; onSaved: (m: Msg) => Promise<void> }) {
  const t = useTranslations('clipsPublish.autopilot');
  const errText = usePublishErrorText();
  const [max, setMax] = useState(String(rule.max_per_day));
  const [gap, setGap] = useState(String(rule.min_gap_minutes));
  const [tags, setTags] = useState(String(rule.hashtag_max));
  const [on, setOn] = useState(rule.enabled);
  const [busy, setBusy] = useState(false);
  const name = platformName(rule.platform);
  return (
    <tr>
      <td title={rule.overridden ? t('custom') : t('default')}>
        {name}
        {rule.overridden && ' •'}
      </td>
      <td>
        <input
          className="ch-input ch-pub-num"
          type="number"
          min={0}
          aria-label={t('col.maxFor', { plataforma: name })}
          value={max}
          onChange={(e) => setMax(e.target.value)}
        />
      </td>
      <td>
        <input
          className="ch-input ch-pub-num"
          type="number"
          min={0}
          aria-label={t('col.gapFor', { plataforma: name })}
          value={gap}
          onChange={(e) => setGap(e.target.value)}
        />
      </td>
      <td>
        <input
          className="ch-input ch-pub-num"
          type="number"
          min={0}
          aria-label={t('col.tagsFor', { plataforma: name })}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </td>
      <td>
        <input
          type="checkbox"
          style={{ width: 20, height: 20, accentColor: 'var(--accent)' }}
          aria-label={t('col.onFor', { plataforma: name })}
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
        />
      </td>
      <td>
        <button
          type="button"
          className="ch-btn ch-btn--gray ch-btn--tiny"
          disabled={busy}
          aria-label={t('saveRule', { plataforma: name })}
          onClick={async () => {
            setBusy(true);
            const r = await publishApi('autopublish/rules/save', {
              body: {
                platform: rule.platform,
                max_per_day: parseInt(max, 10) || 0,
                min_gap_minutes: parseInt(gap, 10) || 0,
                hashtag_max: parseInt(tags, 10) || 0,
                enabled: on,
              },
            });
            setBusy(false);
            await onSaved(
              r.ok
                ? { kind: 'ok', text: t('ruleSaved', { plataforma: name }) }
                : { kind: 'bad', text: errText(r.error) },
            );
          }}
        >
          <Check aria-hidden="true" />
        </button>
      </td>
    </tr>
  );
}

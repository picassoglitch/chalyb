'use client';

// Inversiones (P3-11): connect the exchange (express financial-data
// consent; withdrawal keys refused) → write the rule → review and activate
// (automation_rule_activated). Rules can be paused any time.

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { activateRule, connectExchange, setRuleActive } from '@/lib/tools/extra-actions';
import type { AutomationRule } from '@/lib/tools/adapters/tools';
import { Pill, StepBar } from '@/components/ui/primitives';
import { useWizardStep } from '@/components/ui/use-wizard-step';
import { Markup } from '@/components/ui/markup';

type Draft = { asset: string; side: 'buy' | 'sell'; condition: string; maxAmount: string; schedule: string };
const EMPTY: Draft = { asset: '', side: 'buy', condition: '', maxAmount: '', schedule: '' };

export function InvestWizard({
  exchanges,
  connected,
  initialRules,
}: {
  exchanges: string[];
  connected: string | null;
  initialRules: AutomationRule[];
}) {
  const t = useTranslations('invest');
  const tw = useTranslations('wizard');
  const te = useTranslations('errors.tool');
  const [exchange, setExchange] = useState(connected ?? exchanges[0] ?? '');
  const [isConnected, setConnected] = useState(!!connected);
  const [step, setStep] = useWizardStep(
    [1, 2, 3, 'rules'] as const,
    connected ? (initialRules.length ? 'rules' : 2) : 1,
    (s) => s === 1 || (!!connected && (s === 2 || (s === 'rules' && initialRules.length > 0))),
  );
  const [key, setKey] = useState('');
  const [secret, setSecret] = useState('');
  const [consent, setConsent] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [bad, setBad] = useState<string[]>([]);
  const [rules, setRules] = useState(initialRules);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const errText = (code: string) =>
    code === 'KEY_WITHDRAW'
      ? t('s1.rejected')
      : code === 'KEY_NO_READ'
        ? t('s1.noRead')
        : code === 'INVALID'
          ? tw('fixFields')
          : te('UNKNOWN');

  const summary = t('s3.summary', {
    lado: draft.side === 'buy' ? t('s2.buy') : t('s2.sell'),
    activo: draft.asset.trim().toUpperCase(),
    condicion: draft.condition.trim(),
    monto: Number(draft.maxAmount || 0).toLocaleString('es-MX'),
    horario: draft.schedule.trim(),
  });

  const connect = () =>
    start(async () => {
      setError(null);
      const r = await connectExchange({ exchange, apiKey: key, apiSecret: secret, consentChecked: consent });
      if (r.ok) {
        setConnected(true);
        setKey('');
        setSecret('');
        setStep(2);
      } else setError(errText(r.code));
    });

  const activate = () =>
    start(async () => {
      setError(null);
      const r = await activateRule({ draft: { ...draft, source: 'user' }, exchange, summary, confirmChecked: confirm });
      if (r.ok) {
        setRules((rs) => [r.rule, ...rs]);
        setDraft(EMPTY);
        setConfirm(false);
        setStep('rules');
      } else {
        if ('errors' in r) {
          setBad(r.errors);
          setStep(2);
        }
        setError(errText(r.code));
      }
    });

  const toggle = (rule: AutomationRule) =>
    start(async () => {
      const r = await setRuleActive(rule.id, !rule.active);
      if (r.ok) setRules((rs) => rs.map((x) => (x.id === rule.id ? { ...x, active: !rule.active } : x)));
      else setError(errText(r.code));
    });

  const field = (k: keyof Draft, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="ch-field">
      <label htmlFor={`r-${k}`}>{label}</label>
      <input
        id={`r-${k}`}
        className="ch-input"
        required
        aria-invalid={bad.includes(k) || undefined}
        value={draft[k]}
        onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
        {...props}
      />
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      {typeof step === 'number' && <StepBar step={step} label={tw('step', { n: step })} />}

      <div className="ch-disc" role="note">
        <span className="ch-disc__ic" aria-hidden="true"><ShieldCheck /></span>
        <p><Markup text={t.markup('s1.noWithdraw', { b: (c) => `<b>${c}</b>` })} /></p>
      </div>

      {step === 1 && (
        <form style={{ display: 'grid', gap: 18 }} onSubmit={(e) => { e.preventDefault(); connect(); }}>
          <h1 className="ch-h1">{t('s1.title')}</h1>
          <div className="ch-field">
            <label htmlFor="ex">{t('s1.exchange')}</label>
            <select id="ex" className="ch-input" value={exchange} onChange={(e) => setExchange(e.target.value)}>
              {exchanges.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div className="ch-field">
            <label htmlFor="k">{t('s1.key')}</label>
            <input id="k" className="ch-input" required autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} />
          </div>
          <div className="ch-field">
            <label htmlFor="s">{t('s1.secret')}</label>
            <input id="s" type="password" className="ch-input" required autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} />
          </div>
          <p>
            <Markup
              text={t.markup('s1.consentText', {
                exchange,
                b: (c) => `<b>${c}</b>`,
                privacy: (c) => `<a href="/legal/privacy" class="ch-lnk" target="_blank" rel="noopener">${c}</a>`,
              })}
            />
          </p>
          <label className="ch-check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{t('s1.check')}</span>
          </label>
          {error && <p role="alert" className="ch-err">{error}</p>}
          <button type="submit" className="ch-btn ch-btn--primary ch-btn--xl" disabled={!consent || pending}>{t('s1.cta')}</button>
        </form>
      )}

      {step === 2 && (
        <form style={{ display: 'grid', gap: 18 }} onSubmit={(e) => { e.preventDefault(); setBad([]); setError(null); setStep(3); }}>
          {isConnected && <Pill kind="ok" check>{t('s1.connected', { exchange })}</Pill>}
          <h1 className="ch-h1">{t('s2.title')}</h1>
          <p className="ch-sub">{t('s2.sub')}</p>
          {field('asset', t('s2.asset'), { maxLength: 10, autoCapitalize: 'characters' })}
          <fieldset style={{ border: 0, padding: 0, display: 'grid', gap: 10 }}>
            <legend style={{ fontWeight: 600, marginBottom: 8 }}>{t('s2.side')}</legend>
            {(['buy', 'sell'] as const).map((s) => (
              <label key={s} className="ch-card ch-opt">
                <input type="radio" name="side" checked={draft.side === s} onChange={() => setDraft((d) => ({ ...d, side: s }))} />
                <b>{t(`s2.${s}`)}</b>
              </label>
            ))}
          </fieldset>
          {field('condition', t('s2.condition'), { maxLength: 280, minLength: 4 })}
          {field('maxAmount', t('s2.max'), { inputMode: 'decimal', type: 'number', min: 1, step: 'any' })}
          {field('schedule', t('s2.schedule'), { maxLength: 80 })}
          {error && <p role="alert" className="ch-err">{error}</p>}
          <button type="submit" className="ch-btn ch-btn--primary ch-btn--xl">{tw('continue')}</button>
        </form>
      )}

      {step === 3 && (
        <form style={{ display: 'grid', gap: 18 }} onSubmit={(e) => { e.preventDefault(); activate(); }}>
          <h1 className="ch-h1">{t('s3.title')}</h1>
          <p className="ch-card" style={{ padding: 18 }}>
            <Markup text={t.markup('s3.text', { exchange, resumen_regla: summary, b: (c) => `<b>${c}</b>` })} />
          </p>
          <label className="ch-check">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
            <span>{t('s3.check')}</span>
          </label>
          {error && <p role="alert" className="ch-err">{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="ch-btn ch-btn--secondary" onClick={() => setStep(2)}>{tw('back')}</button>
            <button type="submit" className="ch-btn ch-btn--primary ch-btn--xl" style={{ flex: 1 }} disabled={!confirm || pending}>{t('s3.activate')}</button>
          </div>
        </form>
      )}

      {step === 'rules' && (
        <section style={{ display: 'grid', gap: 14 }} aria-labelledby="rules-t">
          <h1 id="rules-t" className="ch-h1">{t('s3.rules')}</h1>
          {error && <p role="alert" className="ch-err">{error}</p>}
          <ul className="ch-group" style={{ listStyle: 'none', margin: 0 }}>
            {rules.map((r) => (
              <li key={r.id} className="ch-row">
                <span className="ch-row__tx">
                  <b>{t('s3.summary', { lado: t(`s2.${r.side}`), activo: r.asset, condicion: r.condition, monto: r.maxAmount.toLocaleString('es-MX'), horario: r.schedule })}</b>
                  <small><Pill kind={r.active ? 'ok' : 'gray'}>{r.active ? t('s3.active') : t('s3.paused')}</Pill></small>
                </span>
                <button type="button" className="ch-btn ch-btn--secondary ch-btn--compact" disabled={pending} onClick={() => toggle(r)}>
                  {r.active ? t('s3.pause') : t('s3.resume')}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="ch-btn ch-btn--primary" onClick={() => setStep(2)}>{t('s3.newRule')}</button>
        </section>
      )}
    </div>
  );
}

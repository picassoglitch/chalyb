'use client';

// Asistente (P3-8): where it answers → what it must know → try it. Every
// reply starts with the self-identification (added on the server).

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Bot } from 'lucide-react';
import { saveAssistant, testAssistant } from '@/lib/tools/extra-actions';
import type { AssistantChannel, AssistantConfig } from '@/lib/tools/adapters/tools';
import { StepBar } from '@/components/ui/primitives';
import { useWizardStep } from '@/components/ui/use-wizard-step';

export function AssistantWizard({ channels, initial }: { channels: AssistantChannel[]; initial: AssistantConfig | null }) {
  const t = useTranslations('assistant');
  const tw = useTranslations('wizard');
  const te = useTranslations('errors.tool');
  const [step, setStep] = useWizardStep([1, 2, 3] as const, initial ? 3 : 1, (s) => s === 1 || !!initial);
  const [name, setName] = useState(initial?.businessName ?? '');
  const [channel, setChannel] = useState<AssistantChannel>(initial?.channel ?? channels[0] ?? 'web');
  const [knowledge, setKnowledge] = useState(initial?.knowledge ?? '');
  const [msg, setMsg] = useState('');
  const [chat, setChat] = useState<{ me: string; bot: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setError(null);
      const r = await saveAssistant({ businessName: name, channel, knowledge });
      if (r.ok) setStep(3);
      else setError(r.code === 'INVALID' ? tw('fixFields') : te('UNKNOWN'));
    });
  const send = () =>
    start(async () => {
      const r = await testAssistant(msg);
      if (r.ok) {
        setChat((c) => [...c, { me: msg, bot: r.reply }]);
        setMsg('');
      } else setError(te('UNKNOWN'));
    });

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <StepBar step={step} label={tw('step', { n: step })} />
      {step === 1 && (
        <form
          style={{ display: 'grid', gap: 18 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) setStep(2);
          }}
        >
          <h1 className="ch-h1">{t('s1.title')}</h1>
          <div className="ch-field">
            <label htmlFor="biz">{t('s1.business')}</label>
            <input id="biz" className="ch-input" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <fieldset className="ch-opts" style={{ border: 0, padding: 0, display: 'grid', gap: 10 }}>
            <legend className="ch-sr">{t('s1.title')}</legend>
            {channels.map((c) => (
              <label key={c} className="ch-card ch-opt">
                <input type="radio" name="channel" value={c} checked={channel === c} onChange={() => setChannel(c)} />
                <b>{t(`s1.${c}`)}</b>
              </label>
            ))}
          </fieldset>
          <button type="submit" className="ch-btn ch-btn--primary ch-btn--xl">{tw('continue')}</button>
        </form>
      )}
      {step === 2 && (
        <form
          style={{ display: 'grid', gap: 18 }}
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <h1 className="ch-h1">{t('s2.title')}</h1>
          <p className="ch-sub">{t('s2.sub')}</p>
          <div className="ch-field">
            <label htmlFor="know">{t('s2.label')}</label>
            <textarea id="know" className="ch-input ch-textarea" required rows={8} maxLength={8000} value={knowledge} onChange={(e) => setKnowledge(e.target.value)} />
          </div>
          {error && <p role="alert" className="ch-err">{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="ch-btn ch-btn--secondary" onClick={() => setStep(1)}>{tw('back')}</button>
            <button type="submit" className="ch-btn ch-btn--primary ch-btn--xl" style={{ flex: 1 }} disabled={pending}>{tw('continue')}</button>
          </div>
        </form>
      )}
      {step === 3 && (
        <div style={{ display: 'grid', gap: 18 }}>
          <h1 className="ch-h1">{t('s3.title')}</h1>
          <p className="ch-sub">{t('s3.sub')}</p>
          <p className="ch-card" style={{ padding: 14 }} role="status">{t('s3.saved')}</p>
          <ul className="ch-chat" aria-live="polite">
            {chat.map((m, i) => (
              <li key={i}>
                <p className="ch-bubble ch-bubble--me">{m.me}</p>
                <p className="ch-bubble"><Bot aria-hidden="true" /> {m.bot}</p>
              </li>
            ))}
          </ul>
          <form
            style={{ display: 'flex', gap: 10, alignItems: 'end' }}
            onSubmit={(e) => {
              e.preventDefault();
              if (msg.trim()) send();
            }}
          >
            <div className="ch-field" style={{ flex: 1 }}>
              <label htmlFor="msg">{t('s3.label')}</label>
              <input id="msg" className="ch-input" maxLength={500} value={msg} onChange={(e) => setMsg(e.target.value)} />
            </div>
            <button type="submit" className="ch-btn ch-btn--primary" disabled={pending}>{t('s3.send')}</button>
          </form>
          {error && <p role="alert" className="ch-err">{error}</p>}
          <p className="ch-muted">{t('s3.note')}</p>
          <button type="button" className="ch-btn ch-btn--secondary" onClick={() => setStep(2)}>{tw('edit')}</button>
        </div>
      )}
    </div>
  );
}

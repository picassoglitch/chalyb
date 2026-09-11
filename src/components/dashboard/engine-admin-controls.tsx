'use client';

// Two tiny inline selects for the admin engines table — one for status,
// one for tier_required. Optimistic UI + toast feedback + router.refresh()
// so the row count + badges update immediately after a successful change.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '@/lib/dashboard/store';
import {
  changeEngineCostRate,
  changeEngineFixedMonthlyCost,
  changeEngineRoyaltyRate,
  changeEngineStatus,
  changeEngineTierRequired,
} from '@/lib/engines/admin-actions';
import type { EngineStatus } from '@/lib/data/types';
import type { SubscriptionTier } from '@/lib/auth/session';

const STATUS_OPTS: Array<{ value: EngineStatus; label: string }> = [
  { value: 'active', label: 'Activo' },
  { value: 'coming_soon', label: 'Próximamente' },
  { value: 'deprecated', label: 'Deprecado' },
];

const TIER_OPTS: Array<{ value: SubscriptionTier; label: string }> = [
  { value: 'FREE', label: 'Free' },
  { value: 'PRO', label: 'Pro' },
  { value: 'VIP', label: 'VIP' },
];

const selectStyle = (pending: boolean): React.CSSProperties => ({
  background: 'var(--cc-bg-2)',
  border: '1px solid var(--cc-line-2)',
  borderRadius: 7,
  padding: '5px 9px',
  color: 'var(--cc-txt)',
  fontFamily: 'inherit',
  fontSize: 11.5,
  cursor: pending ? 'not-allowed' : 'pointer',
  opacity: pending ? 0.7 : 1,
});

export function EngineStatusSelect({
  engineId,
  current,
  engineName,
}: {
  engineId: string;
  current: EngineStatus;
  engineName: string;
}) {
  const [value, setValue] = useState<EngineStatus>(current);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const showToast = useDashboard((s) => s.showToast);

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as EngineStatus;
    const prev = value;
    setValue(next);
    startTransition(async () => {
      const res = await changeEngineStatus(engineId, next);
      if (!res.ok) {
        setValue(prev);
        showToast(`<b>Error</b> · ${res.error}`);
        return;
      }
      showToast(`<b>${engineName}</b> · estado → ${next}`);
      router.refresh();
    });
  }

  return (
    <select value={value} onChange={onChange} disabled={pending} style={selectStyle(pending)}>
      {STATUS_OPTS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Inline editor for partner_royalty_per_million_tokens_cents.
 *
 *  UX: chip-style display ("$50 / 1M") that flips to a number input on click.
 *  Input value is in DOLLARS for legibility (we store cents, divide by 100
 *  on render and multiply on save). Enter / blur commits; Escape reverts.
 *
 *  Why cents under the hood: floating-point math on currency = bad. The DB
 *  column is INTEGER. The input is a friendly $X.XX MXN for the operator. */
export function EngineRoyaltyRateInput({
  engineId,
  currentCents,
  engineName,
}: {
  engineId: string;
  currentCents: number;
  engineName: string;
}) {
  const [cents, setCents] = useState<number>(currentCents);
  const [editing, setEditing] = useState(false);
  // Track the input as a string so the user can type "50.50" without it
  // getting parsed mid-keystroke and clobbering their cursor.
  const [draft, setDraft] = useState<string>(centsToInputStr(currentCents));
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const showToast = useDashboard((s) => s.showToast);

  function startEdit() {
    setDraft(centsToInputStr(cents));
    setEditing(true);
  }

  function commit() {
    const parsed = parseInputToCents(draft);
    if (parsed === null) {
      showToast('<b>Cantidad inválida</b> · usa formato 50 o 50.25');
      setDraft(centsToInputStr(cents));
      setEditing(false);
      return;
    }
    if (parsed === cents) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const res = await changeEngineRoyaltyRate(engineId, parsed);
      if (!res.ok) {
        showToast(`<b>Error</b> · ${res.error}`);
        setDraft(centsToInputStr(cents));
        return;
      }
      setCents(parsed);
      showToast(
        `<b>${engineName}</b> · regalía $${(parsed / 100).toLocaleString('es-MX')} / 1M tokens`,
      );
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    setDraft(centsToInputStr(cents));
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        title="Toca para editar la regalía"
        style={{
          padding: '5px 9px',
          borderRadius: 7,
          border: '1px solid var(--cc-line-2)',
          background: cents > 0 ? 'var(--cc-cyan-g)' : 'var(--cc-bg-2)',
          color: cents > 0 ? 'var(--cc-cyan)' : 'var(--cc-txt-3)',
          fontFamily: 'var(--cc-mono), monospace',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          letterSpacing: '0.02em',
        }}
      >
        ${(cents / 100).toLocaleString('es-MX')} / 1M
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10.5, color: 'var(--cc-txt-4)', fontFamily: 'var(--cc-mono), monospace' }}>
        $
      </span>
      <input
        type="number"
        min={0}
        step={0.5}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            cancel();
          }
        }}
        onBlur={() => {
          // Wait one tick — if the blur is going to a click on Save it
          // would clobber the commit. Cheap to schedule via setTimeout 0.
          setTimeout(() => {
            if (editing) commit();
          }, 0);
        }}
        autoFocus
        disabled={pending}
        style={{
          width: 80,
          padding: '5px 8px',
          borderRadius: 7,
          border: '1px solid var(--cc-line-2)',
          background: 'var(--cc-bg-1)',
          color: 'var(--cc-txt)',
          fontFamily: 'var(--cc-mono), monospace',
          fontSize: 11.5,
        }}
      />
      <span
        style={{
          fontSize: 10,
          color: 'var(--cc-txt-4)',
          fontFamily: 'var(--cc-mono), monospace',
          letterSpacing: '0.06em',
        }}
      >
        / 1M
      </span>
    </div>
  );
}

function centsToInputStr(cents: number): string {
  if (cents <= 0) return '0';
  if (cents % 100 === 0) return String(cents / 100);
  return (cents / 100).toFixed(2);
}

function parseInputToCents(raw: string): number | null {
  const cleaned = raw.replace(/[\s,$]/g, '');
  if (!cleaned) return 0;
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

// Generic factory for cents-input chips. We have three near-identical
// editors (royalty / cost / fixed-monthly) so this collapses the JSX. Each
// takes a save callback + display config (color, suffix label, toast verb).
function CentsChipEditor({
  engineId,
  currentCents,
  engineName,
  onSave,
  suffix,
  toastVerb,
  emptyTone,
  filledTone,
}: {
  engineId: string;
  currentCents: number;
  engineName: string;
  onSave: (engineId: string, cents: number) => Promise<{ ok: boolean; error?: string }>;
  /** e.g. "/ 1M" or "/ mes". Shown both in the chip and after the input. */
  suffix: string;
  /** Verb for the success toast, e.g. "cost rate", "fixed cost", "royalty". */
  toastVerb: string;
  emptyTone: 'muted' | 'cyan';
  filledTone: 'cyan' | 'green' | 'amber';
}) {
  const [cents, setCents] = useState<number>(currentCents);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(centsToInputStr(currentCents));
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const showToast = useDashboard((s) => s.showToast);

  function startEdit() {
    setDraft(centsToInputStr(cents));
    setEditing(true);
  }

  function commit() {
    const parsed = parseInputToCents(draft);
    if (parsed === null) {
      showToast('<b>Cantidad inválida</b> · usa formato 50 o 50.25');
      setDraft(centsToInputStr(cents));
      setEditing(false);
      return;
    }
    if (parsed === cents) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const res = await onSave(engineId, parsed);
      if (!res.ok) {
        showToast(`<b>Error</b> · ${res.error}`);
        setDraft(centsToInputStr(cents));
        return;
      }
      setCents(parsed);
      showToast(
        `<b>${engineName}</b> · ${toastVerb} $${(parsed / 100).toLocaleString('es-MX')} ${suffix}`,
      );
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    setDraft(centsToInputStr(cents));
    setEditing(false);
  }

  if (!editing) {
    const bg = cents > 0
      ? filledTone === 'green'
        ? 'var(--cc-green-g)'
        : filledTone === 'amber'
          ? 'rgba(245,177,61,0.12)'
          : 'var(--cc-cyan-g)'
      : 'var(--cc-bg-2)';
    const fg = cents > 0
      ? filledTone === 'green'
        ? 'var(--cc-green)'
        : filledTone === 'amber'
          ? 'var(--cc-amber, #f5b13d)'
          : 'var(--cc-cyan)'
      : emptyTone === 'cyan'
        ? 'var(--cc-cyan)'
        : 'var(--cc-txt-3)';
    return (
      <button
        type="button"
        onClick={startEdit}
        title="Toca para editar"
        style={{
          padding: '5px 9px',
          borderRadius: 7,
          border: '1px solid var(--cc-line-2)',
          background: bg,
          color: fg,
          fontFamily: 'var(--cc-mono), monospace',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
        }}
      >
        ${(cents / 100).toLocaleString('es-MX')} {suffix}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10.5, color: 'var(--cc-txt-4)', fontFamily: 'var(--cc-mono), monospace' }}>
        $
      </span>
      <input
        type="number"
        min={0}
        step={0.5}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            cancel();
          }
        }}
        onBlur={() => {
          setTimeout(() => {
            if (editing) commit();
          }, 0);
        }}
        autoFocus
        disabled={pending}
        style={{
          width: 90,
          padding: '5px 8px',
          borderRadius: 7,
          border: '1px solid var(--cc-line-2)',
          background: 'var(--cc-bg-1)',
          color: 'var(--cc-txt)',
          fontFamily: 'var(--cc-mono), monospace',
          fontSize: 11.5,
        }}
      />
      <span
        style={{
          fontSize: 10,
          color: 'var(--cc-txt-4)',
          fontFamily: 'var(--cc-mono), monospace',
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
        }}
      >
        {suffix}
      </span>
    </div>
  );
}

/** What WE pay providers per 1M tokens consumed in this engine. */
export function EngineCostRateInput({
  engineId,
  currentCents,
  engineName,
}: {
  engineId: string;
  currentCents: number;
  engineName: string;
}) {
  return (
    <CentsChipEditor
      engineId={engineId}
      currentCents={currentCents}
      engineName={engineName}
      onSave={changeEngineCostRate}
      suffix="/ 1M"
      toastVerb="costo"
      emptyTone="muted"
      filledTone="amber"
    />
  );
}

/** Monthly fixed infra (Modal baseline, allocated Vercel/Railway slice). */
export function EngineFixedCostInput({
  engineId,
  currentCents,
  engineName,
}: {
  engineId: string;
  currentCents: number;
  engineName: string;
}) {
  return (
    <CentsChipEditor
      engineId={engineId}
      currentCents={currentCents}
      engineName={engineName}
      onSave={changeEngineFixedMonthlyCost}
      suffix="/ mes"
      toastVerb="costo fijo"
      emptyTone="muted"
      filledTone="amber"
    />
  );
}

export function EngineTierSelect({
  engineId,
  current,
  engineName,
}: {
  engineId: string;
  current: SubscriptionTier;
  engineName: string;
}) {
  const [value, setValue] = useState<SubscriptionTier>(current);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const showToast = useDashboard((s) => s.showToast);

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as SubscriptionTier;
    const prev = value;
    setValue(next);
    startTransition(async () => {
      const res = await changeEngineTierRequired(engineId, next);
      if (!res.ok) {
        setValue(prev);
        showToast(`<b>Error</b> · ${res.error}`);
        return;
      }
      showToast(`<b>${engineName}</b> · requiere ${next.replace('_', '-')}`);
      router.refresh();
    });
  }

  return (
    <select value={value} onChange={onChange} disabled={pending} style={selectStyle(pending)}>
      {TIER_OPTS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

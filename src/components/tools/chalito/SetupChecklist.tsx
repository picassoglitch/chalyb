'use client';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { SetupStep } from '@chalito/ui/setup';
import { Link } from '@/lib/chalito/navigation';
import { useChalito, useLive } from '@/lib/chalito/provider';
import { SETUP_RESYNC_MS, setupState } from '@/lib/chalito/web/setup';
import { SignInLink } from './SignInLink';

/** The live state the checklist reads, for any screen that wants to know if setup is done. */
export const useSetup = () => {
  const { status, session, needsRecovery, client } = useChalito();
  const live = useLive();
  const state = setupState({
    status,
    signedIn: session.status === 'signed_in' || status === 'ready',
    needsRecovery,
    devices: live.devices,
    sessions: live.sessions,
  });
  // A computer's setup report doesn't fan out to every phone (presence-only), so re-read while
  // something is left; a pull costs one query per table.
  useEffect(() => {
    if (!client || state.complete) return;
    const timer = setInterval(
      () => void client.live.resync().catch(() => undefined),
      SETUP_RESYNC_MS,
    );
    return () => clearInterval(timer);
  }, [client, state.complete]);
  return state;
};

/** Where each open step's one button goes (the hub's routes; the folder is chosen on the computer). */
const ACTIONS: Partial<
  Record<SetupStep, string | { pathname: string; query: Record<string, string> }>
> = {
  browser: '/dispositivos',
  computer: '/descargar',
  ai: '/ajustes',
  firstTask: { pathname: '/sesiones/nueva', query: { first: '1' } },
};

/**
 * First Run D (ADR 0028 §6): "Pon a trabajar a Chalito". Six steps read from real state (account,
 * this browser, a computer, an AI, a folder, a first task); nothing here can tick one. It shows
 * until everything is done, with one clear button for the step that's next.
 */
export const SetupChecklist = ({ compact = false }: { compact?: boolean }) => {
  const t = useTranslations('chalito.setup');
  const state = useSetup();
  if (state.complete) return null;
  return (
    <section
      className="ch-card ch-chl-card ch-chl ch-chl--tight"
      aria-labelledby="setup-title"
      data-testid="setup-checklist"
    >
      <div className="ch-chl-row ch-chl-row--between">
        <h2 id="setup-title" className="ch-chl-strong">
          {t('title')}
        </h2>
        <span className="ch-chl-small" data-testid="setup-progress">
          {t('progress', { done: state.doneCount, total: state.steps.length })}
        </span>
      </div>
      <ol className="ch-chl-setup">
        {state.steps.map(({ id, done }) => {
          const current = id === state.current;
          if (compact && !current && !done) return null;
          const href = ACTIONS[id];
          return (
            <li
              key={id}
              data-step={id}
              data-done={done}
              aria-current={current ? 'step' : undefined}
              className={`ch-chl-setup__item${done ? ' ch-chl-setup__item--done' : current ? ' ch-chl-setup__item--now' : ''}`}
            >
              <span aria-hidden className="ch-chl-setup__mark">
                {done ? '✓' : current ? '→' : ''}
              </span>
              <span className="ch-chl-setup__body">
                <span className={current ? 'ch-chl-strong' : undefined}>{t(`step.${id}`)}</span>
                <span className="ch-sr">{t(done ? 'done' : 'todo')}</span>
                {current ? (
                  <>
                    <span className="ch-chl-small ch-muted">{t(`hint.${id}`)}</span>
                    {id === 'account' ? (
                      <SignInLink className="ch-btn ch-btn--primary ch-btn--compact ch-chl-fit">
                        {t('action.account')}
                      </SignInLink>
                    ) : href ? (
                      <Link
                        href={href}
                        className="ch-btn ch-btn--primary ch-btn--compact ch-chl-fit"
                        data-testid={`setup-go-${id}`}
                      >
                        {t(`action.${id}`)}
                      </Link>
                    ) : null}
                  </>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

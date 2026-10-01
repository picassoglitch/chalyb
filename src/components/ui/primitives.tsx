// The design system's static building blocks (rebuild prompt §5, BUILD-SPEC
// §1.6). Server-safe: no state, no effects. Styling lives in
// src/styles/chalyb-tokens.css under .chalyb-app; these only pick classes.
//
// No copy here: every visible string arrives as a prop, already translated.

import type { Route } from 'next';
import type { ReactNode } from 'react';
import { ArrowRight, Check, ChevronRight, Info, TriangleAlert } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { BrandMark } from '@/components/landing/brand-mark';
import { ToolIcon as ToolIconInline } from './tool-icon';

type Variant = 'primary' | 'secondary' | 'gray' | 'danger' | 'ok' | 'white' | 'dark';

function btnClass(variant: Variant, size?: 'xl' | 'compact', extra?: string) {
  return ['ch-btn', `ch-btn--${variant}`, size ? `ch-btn--${size}` : '', extra ?? '']
    .filter(Boolean)
    .join(' ');
}

export function ButtonLink({
  href,
  variant = 'primary',
  size,
  children,
  className,
  ...rest
}: {
  href: string;
  variant?: Variant;
  size?: 'xl' | 'compact';
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <Link href={href as Route} className={btnClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

export function Button({
  variant = 'primary',
  size,
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'xl' | 'compact';
}) {
  return (
    <button type="button" className={btnClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`ch-card ${className ?? ''}`} style={style}>
      {children}
    </div>
  );
}

export function GroupHeader({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 className="ch-ghead" id={id}>
      {children}
    </h2>
  );
}

/** A titled iOS-style list. */
export function Group({ title, children }: { title?: string; children: ReactNode }) {
  const id = title ? `g-${title.toLowerCase().replace(/\W+/g, '-')}` : undefined;
  return (
    <section aria-labelledby={id}>
      {title && <GroupHeader id={id}>{title}</GroupHeader>}
      <div className="ch-group">{children}</div>
    </section>
  );
}

/** One row: icon tile, text, value, chevron. A row with `href` is a link;
 *  without one it's static (never a dead button). */
export function Row({
  icon,
  iconColor,
  title,
  detail,
  value,
  href,
  trailing,
}: {
  icon?: ReactNode;
  iconColor?: string;
  title: ReactNode;
  detail?: ReactNode;
  value?: ReactNode;
  href?: string;
  trailing?: ReactNode;
}) {
  const body = (
    <>
      {icon && (
        <span
          className="ch-row__ic"
          style={iconColor ? { background: iconColor } : undefined}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <span className="ch-row__tx">
        <b>{title}</b>
        {detail && <small>{detail}</small>}
      </span>
      {value !== undefined && <span className="ch-row__val">{value}</span>}
      {trailing}
      {href && <ChevronRight className="ch-row__chev" aria-hidden="true" />}
    </>
  );
  return href ? (
    <Link href={href as Route} className="ch-row">
      {body}
    </Link>
  ) : (
    <div className="ch-row">{body}</div>
  );
}

export function Chip({
  children,
  on,
  small,
}: {
  children: ReactNode;
  on?: boolean;
  small?: boolean;
}) {
  return (
    <span className={`ch-chip${on ? ' ch-chip--on' : ''}${small ? ' ch-chip--sm' : ''}`}>
      {children}
    </span>
  );
}

export function Pill({
  kind = 'gray',
  children,
  check,
}: {
  kind?: 'ok' | 'acc' | 'warn' | 'bad' | 'gray' | 'dark';
  children: ReactNode;
  check?: boolean;
}) {
  return (
    <span className={`ch-pill ch-pill--${kind}`}>
      {check && <Check aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Gradient initials. */
export function Avatar({ name, large }: { name: string; large?: boolean }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || '·';
  return (
    <span className={`ch-avatar${large ? ' ch-avatar--lg' : ''}`} aria-hidden="true">
      {initials}
    </span>
  );
}

/** The shipped 2026 emblem + wordmark (Q27: shipped mark, not the mockup's C). */
export function Logo({ href }: { href?: string }) {
  const inner = (
    <>
      <span className="ch-logo__mark">
        <BrandMark size={40} />
      </span>
      <span className="ch-logo__word">Chalyb</span>
    </>
  );
  return href ? (
    <Link href={href as Route} className="ch-logo">
      {inner}
    </Link>
  ) : (
    <span className="ch-logo">{inner}</span>
  );
}

/** "Lo importante del cobro" box — never below 14px, never gray. */
export function DisclosureBlock({ children }: { children: ReactNode }) {
  return (
    <div className="ch-disc">
      <span className="ch-disc__ic" aria-hidden="true">
        <Info />
      </span>
      <div>{children}</div>
    </div>
  );
}

/** One line and at most one button (BUILD-SPEC §6.8, mockup 17). */
export function Banner({
  kind,
  children,
  action,
}: {
  kind: 'trial' | 'warn' | 'gray' | 'bad';
  children: ReactNode;
  action?: { href: string; label: string };
}) {
  const Icon = kind === 'trial' ? Info : TriangleAlert;
  return (
    <div
      className={`ch-bnr ch-bnr--${kind}`}
      role={kind === 'bad' || kind === 'warn' ? 'alert' : 'status'}
    >
      <span className="ch-bnr__ic" aria-hidden="true">
        <Icon />
      </span>
      <span className="ch-bnr__tx">{children}</span>
      {action && (
        <ButtonLink href={action.href} variant="white" size="compact">
          {action.label}
        </ButtonLink>
      )}
    </div>
  );
}

/** Empty / error states (BUILD-SPEC §7.6): exactly one primary action. */
export function StateBlock({
  icon,
  title,
  body,
  action,
  secondary,
  role,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: { href: string; label: string };
  secondary?: { href: string; label: string };
  role?: 'alert' | 'status';
}) {
  return (
    <div className="ch-card ch-state" role={role}>
      <span className="ch-state__ic" aria-hidden="true">
        {icon}
      </span>
      <h2 className="ch-h2">{title}</h2>
      {body && (
        <p className="ch-muted" style={{ maxWidth: 520 }}>
          {body}
        </p>
      )}
      {(action || secondary) && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginTop: 6,
          }}
        >
          {action && <ButtonLink href={action.href}>{action.label}</ButtonLink>}
          {secondary && (
            <ButtonLink href={secondary.href} variant="ok">
              {secondary.label}
            </ButtonLink>
          )}
        </div>
      )}
    </div>
  );
}

/** Admin sample data only; production never shows it. */
export function ExampleTag({ children }: { children: ReactNode }) {
  return <span className="ch-tag-ej">{children}</span>;
}

export function Skeleton({
  height = 120,
  style,
}: {
  height?: number;
  style?: React.CSSProperties;
}) {
  return <div className="ch-skel" style={{ height, ...style }} aria-hidden="true" />;
}

/** "Paso N de 3". */
export function StepBar({
  step,
  total = 3,
  label,
}: {
  step: number;
  total?: number;
  label: string;
}) {
  return (
    <div className="ch-steps">
      <div className="ch-steps__bar" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <i key={i} className={i < step ? 'on' : ''} />
        ))}
      </div>
      <p className="ch-steps__t">{label}</p>
    </div>
  );
}

/** The big task card on Inicio (mockups 01/08). The first one gets the
 *  accent ring and a filled icon tile. */
export function TaskCard({
  href,
  slug,
  label,
  title,
  body,
  shortBody,
  first,
}: {
  href: string;
  slug: string;
  label: string;
  title: string;
  body: string;
  /** Mobile copy (SCR-08); falls back to `body`. */
  shortBody?: string;
  first?: boolean;
}) {
  return (
    <Link href={href as Route} className={`ch-task${first ? ' ch-task--first' : ''}`}>
      <ToolIconInline slug={slug} filled={first} />
      <span className="ch-task__tx">
        <span className="ch-label">{label}</span>
        <span className="ch-task__h">{title}</span>
        {shortBody && shortBody !== body ? (
          <>
            <span className="ch-task__p ch-task__p--long">{body}</span>
            <span className="ch-task__p ch-task__p--short">{shortBody}</span>
          </>
        ) : (
          <span className="ch-task__p">{body}</span>
        )}
      </span>
      <span className="ch-task__go" aria-hidden="true">
        <ArrowRight />
      </span>
    </Link>
  );
}

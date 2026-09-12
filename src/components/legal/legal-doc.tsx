// Renders a legal document (terms / privacy) straight out of messages/*.json.
//
// The document body lives under `legal.<doc>` as data rather than JSX so both
// locales stay in lockstep: one shape, two translations. A section is
// `{ id, t, blocks[] }`; a block is one of `p`, `h3`, `ul` or `callout`.
// Section numbering is derived from the array order — the heading renders
// "3. …" and the table of contents links to `#id`, so neither can drift.
//
// Inline markup uses next-intl rich-text tags (see TAGS below) instead of
// raw HTML, which keeps internal links going through the locale-aware
// `Link` from @/i18n/routing.

import { Fragment, type ReactNode } from 'react';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

export type LegalDocName = 'privacy' | 'terms';

interface Block {
  p?: string;
  h3?: string;
  ul?: string[];
  callout?: string;
}

interface Section {
  id: string;
  t: string;
  blocks: Block[];
}

const TAGS = {
  b: (chunks: ReactNode) => <strong>{chunks}</strong>,
  em: (chunks: ReactNode) => <em>{chunks}</em>,
  code: (chunks: ReactNode) => <code>{chunks}</code>,
  contact: (chunks: ReactNode) => <Link href={'/contacto' as Route}>{chunks}</Link>,
  sub: (chunks: ReactNode) => <Link href={'/app/subscription' as Route}>{chunks}</Link>,
  team: (chunks: ReactNode) => <Link href={'/dashboard/team' as Route}>{chunks}</Link>,
};

export function LegalDoc({ doc }: { doc: LegalDocName }) {
  const t = useTranslations(`legal.${doc}`);
  const tLegal = useTranslations('legal');
  const sections = t.raw('sections') as Section[];

  function block(base: string, b: Block, i: number) {
    if (b.h3 !== undefined) return <h3 key={i}>{t.rich(`${base}.${i}.h3`, TAGS)}</h3>;
    if (b.ul !== undefined)
      return (
        <ul key={i}>
          {b.ul.map((_, j) => (
            <li key={j}>{t.rich(`${base}.${i}.ul.${j}`, TAGS)}</li>
          ))}
        </ul>
      );
    if (b.callout !== undefined)
      return (
        <div key={i} className="legal-callout">
          {t.rich(`${base}.${i}.callout`, TAGS)}
        </div>
      );
    return <p key={i}>{t.rich(`${base}.${i}.p`, TAGS)}</p>;
  }

  return (
    <>
      <div className="legal-toc">
        <strong style={{ color: 'var(--ink)', display: 'block', marginBottom: 8 }}>
          {tLegal('toc')}
        </strong>
        <ol>
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.t}</a>
            </li>
          ))}
        </ol>
      </div>

      <p>{t.rich('intro', TAGS)}</p>

      {/* Flat fragments, no wrapper element: `.legal-prose h2` draws the
          separator rule above every section and `h2:first-child` suppresses
          it on the first one. Wrapping each section would make every h2 a
          first child and lose all the rules. */}
      {sections.map((section, i) => (
        <Fragment key={section.id}>
          <h2 id={section.id}>
            {i + 1}. {section.t}
          </h2>
          {section.blocks.map((b, j) => block(`sections.${i}.blocks`, b, j))}
        </Fragment>
      ))}

      <div className="legal-callout" style={{ marginTop: 40 }}>
        {t.rich('outro', TAGS)}
      </div>
    </>
  );
}

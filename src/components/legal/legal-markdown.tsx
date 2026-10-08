// Law's Markdown (src/lib/legal/markdown.ts) as React elements inside
// .legal-prose. Text nodes only: nothing is injected as HTML.

import type { ReactNode } from 'react';
import type { Block, Inline } from '@/lib/legal/markdown';
import { inlineText } from '@/lib/legal/markdown';

function inlines(c: Inline[]): ReactNode[] {
  return c.map((n, i) => {
    switch (n.t) {
      case 'text':
        return n.v;
      case 'code':
        return <code key={i}>{n.v}</code>;
      case 'b':
        return <strong key={i}>{inlines(n.c)}</strong>;
      case 'i':
        return <em key={i}>{inlines(n.c)}</em>;
      case 'a':
        return (
          <a key={i} href={n.href}>
            {inlines(n.c)}
          </a>
        );
    }
  });
}

function blocks(list: Block[], skipTitle: boolean): ReactNode[] {
  return list.map((b, i) => {
    switch (b.t) {
      case 'h': {
        if (b.level === 1 && skipTitle) return null;
        // The page's <h1> is the document title, so Markdown levels shift down one.
        const Tag = (['h2', 'h2', 'h3', 'h4'] as const)[b.level - 1]!;
        return (
          <Tag key={i} id={b.id}>
            {inlines(b.c)}
          </Tag>
        );
      }
      case 'p':
        return <p key={i}>{inlines(b.c)}</p>;
      case 'quote':
        return (
          <div key={i} className="legal-callout">
            {blocks(b.c, false)}
          </div>
        );
      case 'ul':
        return (
          <ul key={i}>
            {b.items.map((it, j) => (
              <li key={j}>{inlines(it)}</li>
            ))}
          </ul>
        );
      case 'ol':
        return (
          <ol key={i} start={b.start}>
            {b.items.map((it, j) => (
              <li key={j}>{inlines(it)}</li>
            ))}
          </ol>
        );
      case 'table':
        return (
          <div
            key={i}
            className="legal-table"
            role="region"
            aria-label={inlineText(b.head[0] ?? [])}
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  {b.head.map((c, j) => (
                    <th key={j} scope="col">
                      {inlines(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, j) => (
                  <tr key={j}>
                    {r.map((c, k) => (
                      <td key={k}>{inlines(c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'hr':
        return <hr key={i} />;
    }
  });
}

/** Sections (level-2 headings) for the table of contents. */
export function tocEntries(list: Block[]): { id: string; text: string }[] {
  return list.flatMap((b) =>
    b.t === 'h' && b.level === 2 ? [{ id: b.id, text: inlineText(b.c) }] : [],
  );
}

export function LegalMarkdown({ blocks: list, tocLabel }: { blocks: Block[]; tocLabel: string }) {
  const toc = tocEntries(list);
  return (
    <>
      {toc.length > 2 && (
        <nav className="legal-toc" aria-label={tocLabel}>
          <strong style={{ color: 'var(--ink)', display: 'block', marginBottom: 8 }}>
            {tocLabel}
          </strong>
          <ol>
            {toc.map((e) => (
              <li key={e.id}>
                <a href={`#${e.id}`}>{e.text}</a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      {blocks(list, true)}
    </>
  );
}

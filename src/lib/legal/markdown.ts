// The small Markdown subset Law writes the legal documents in, parsed to a
// plain tree: headings, paragraphs, block quotes, flat ordered/unordered
// lists, pipe tables and rules; inline **bold**, *italic*, [links](url) and
// backslash escapes. No HTML passes through: every character that isn't one
// of those marks is text, so the renderer never needs innerHTML.
//
// Pure (no React), so tests and `pnpm test:legal` read the same text the
// pages render.

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'b'; c: Inline[] }
  | { t: 'i'; c: Inline[] }
  | { t: 'a'; href: string; c: Inline[] };

export type Block =
  | { t: 'h'; level: 1 | 2 | 3 | 4; id: string; c: Inline[] }
  | { t: 'p'; c: Inline[] }
  | { t: 'quote'; c: Block[] }
  | { t: 'ul' | 'ol'; start: number; items: Inline[][] }
  | { t: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { t: 'hr' };

const ESCAPABLE_CHARS = '\\`*_{}[]()#+-.!|>';
const ESCAPABLE = /\\([\\`*_{}[\]()#+\-.!|>])/g;

/** URL-safe anchor from heading text: "4 bis. Pro Lealtad" → "4-bis-pro-lealtad". */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let buf = '';
  const flush = () => {
    if (buf) out.push({ t: 'text', v: buf.replace(ESCAPABLE, '$1') });
    buf = '';
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === '\\' && i + 1 < src.length && ESCAPABLE_CHARS.includes(src[i + 1]!)) {
      buf += src.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (src.startsWith('**', i)) {
      const end = findClose(src, '**', i + 2);
      if (end > i + 2) {
        flush();
        out.push({ t: 'b', c: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (ch === '*' && src[i + 1] !== ' ' && src[i + 1] !== '*') {
      const end = findClose(src, '*', i + 1);
      if (end > i + 1 && src[end - 1] !== ' ') {
        flush();
        out.push({ t: 'i', c: parseInline(src.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    if (ch === '[') {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(src.slice(i));
      if (m && safeHref(m[2]!)) {
        flush();
        out.push({ t: 'a', href: m[2]!, c: parseInline(m[1]!) });
        i += m[0].length;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return out;
}

function findClose(src: string, mark: string, from: number): number {
  for (let j = from; j < src.length; j++) {
    if (src[j] === '\\') {
      j++;
      continue;
    }
    if (src.startsWith(mark, j) && (mark !== '*' || src[j + 1] !== '*')) return j;
  }
  return -1;
}

/** Only site paths, anchors and https/mailto links render as links. */
export function safeHref(href: string): boolean {
  return /^(\/(?!\/)|#|https:\/\/|mailto:)/.test(href);
}

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((cell) => parseInline(cell.trim()));

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  const ids = new Map<string, number>();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const text = h[2]!.trim();
      let id = slugify(text) || 'seccion';
      const seen = ids.get(id) ?? 0;
      ids.set(id, seen + 1);
      if (seen) id = `${id}-${seen + 1}`;
      blocks.push({ t: 'h', level: h[1]!.length as 1 | 2 | 3 | 4, id, c: parseInline(text) });
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ t: 'hr' });
      i++;
      continue;
    }
    if (line.startsWith('>')) {
      const inner: string[] = [];
      while (i < lines.length && lines[i]!.startsWith('>'))
        inner.push(lines[i++]!.replace(/^>\s?/, ''));
      blocks.push({ t: 'quote', c: parseMarkdown(inner.join('\n')) });
      continue;
    }
    if (line.trim().startsWith('|') && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? '')) {
      const head = splitRow(line);
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && lines[i]!.trim().startsWith('|')) rows.push(splitRow(lines[i++]!));
      blocks.push({ t: 'table', head, rows });
      continue;
    }
    const li = /^\s*([-*]|\d+\.)\s+/.exec(line);
    if (li) {
      const ordered = li[1] !== '-' && li[1] !== '*';
      const items: Inline[][] = [];
      const start = ordered ? Number.parseInt(li[1]!, 10) : 1;
      while (i < lines.length) {
        const m = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(lines[i]!);
        if (!m || (m[1] !== '-' && m[1] !== '*') === !ordered) break;
        items.push(parseInline(m[2]!));
        i++;
      }
      blocks.push({ t: ordered ? 'ol' : 'ul', start, items });
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !/^(#{1,4}\s|>|\s*([-*]|\d+\.)\s+|(-{3,}|\*{3,})\s*$)/.test(lines[i]!) &&
      !(lines[i]!.trim().startsWith('|') && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? ''))
    ) {
      para.push(lines[i++]!.trim());
    }
    blocks.push({ t: 'p', c: parseInline(para.join(' ')) });
  }
  return blocks;
}

export function inlineText(c: Inline[]): string {
  return c.map((n) => (n.t === 'text' ? n.v : inlineText(n.c))).join('');
}

/** The visible text of a document, one block per line (tests, test:legal). */
export function blocksText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.t) {
        case 'h':
        case 'p':
          return inlineText(b.c);
        case 'quote':
          return blocksText(b.c);
        case 'ul':
        case 'ol':
          return b.items.map(inlineText).join('\n');
        case 'table':
          return [b.head, ...b.rows].map((r) => r.map(inlineText).join(' | ')).join('\n');
        case 'hr':
          return '';
      }
    })
    .join('\n');
}

/** Map every text node (used to bind amounts to config at render). */
export function mapText(blocks: Block[], fn: (s: string) => string): Block[] {
  const mi = (c: Inline[]): Inline[] =>
    c.map((n) => (n.t === 'text' ? { ...n, v: fn(n.v) } : { ...n, c: mi(n.c) }));
  return blocks.map((b): Block => {
    switch (b.t) {
      case 'h':
      case 'p':
        return { ...b, c: mi(b.c) };
      case 'quote':
        return { ...b, c: mapText(b.c, fn) };
      case 'ul':
      case 'ol':
        return { ...b, items: b.items.map(mi) };
      case 'table':
        return { ...b, head: b.head.map(mi), rows: b.rows.map((r) => r.map(mi)) };
      case 'hr':
        return b;
    }
  });
}

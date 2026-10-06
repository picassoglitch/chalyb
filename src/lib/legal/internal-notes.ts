// Law's Markdown can end a document with "## Notas internas (no publicar …)":
// the attorney's notes to the owner and the team. The Markdown stays as Law
// wrote it; `pnpm legal:hash` archives the published text without those
// sections, so they never render and the consent hash never covers them.
//
// A section runs from its heading to the next heading of the same or a higher
// level (or the end). A rule (---) or blank lines left just before it go too.
// Pure.

const NOTES_HEADING = /^(#{1,6})\s+Notas internas\b/i;

export function stripInternalNotes(source: string): string {
  const lines = source.split('\n');
  const out: string[] = [];
  let skipLevel = 0;
  for (const line of lines) {
    const heading = /^(#{1,6})\s/.exec(line);
    if (skipLevel) {
      if (!heading || heading[1]!.length > skipLevel) continue;
      skipLevel = 0;
    }
    const notes = NOTES_HEADING.exec(line);
    if (notes) {
      while (out.length && /^\s*(-{3,}|\*{3,}|_{3,})?\s*$/.test(out[out.length - 1]!)) out.pop();
      skipLevel = notes[1]!.length;
      continue;
    }
    out.push(line);
  }
  const text = out.join('\n');
  return source.endsWith('\n') && !text.endsWith('\n') ? `${text}\n` : text;
}

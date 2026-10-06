#!/usr/bin/env node
// The legal publish state computed from the registry and the archive (not
// from the committed publish-state.json): per document, the current version,
// whether it's marked published, how many brackets its rendered text still
// has and where it disagrees with the config. legal:hash writes it to
// publish-state.json; the build gate recomputes it when LEGAL_PUBLISH=true.
// Run through tests/ts-resolve.mjs; printed as JSON when run directly.

const { LEGAL_DOCS, consistencyIssues, currentVersion, placeholders, versionMeta } =
  await import('../src/lib/legal/registry.ts');

export function computeLegalState() {
  return Object.fromEntries(
    LEGAL_DOCS.map((doc) => [
      doc,
      {
        version: currentVersion(doc),
        published: Boolean(versionMeta(doc)?.published),
        placeholders: placeholders(doc).length,
        consistency: consistencyIssues(doc),
      },
    ]),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(JSON.stringify(computeLegalState()));
}

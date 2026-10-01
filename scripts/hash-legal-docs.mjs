#!/usr/bin/env node
// pnpm legal:hash — fingerprints the legal documents every consent event
// cites (aceptacion-ux §10.2 `documents`). Writes
// src/lib/legal/document-hashes.json. Run it whenever a legal text changes
// and bump that document's version in src/lib/legal/documents.ts.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const DIR = new URL('../docs/design/app-reimagine/legal/', import.meta.url);
const FILES = {
  terminos: 'terminos-y-condiciones.md',
  suscripcion: 'terminos-de-suscripcion.md',
  privacidad: 'aviso-de-privacidad.md',
  uso_aceptable: 'uso-aceptable-y-contenido.md',
};

const out = Object.fromEntries(
  Object.entries(FILES).map(([doc, file]) => [
    doc,
    createHash('sha256').update(readFileSync(new URL(file, DIR))).digest('hex'),
  ]),
);
writeFileSync(new URL('../src/lib/legal/document-hashes.json', import.meta.url), `${JSON.stringify(out, null, 2)}\n`);
console.log(out);

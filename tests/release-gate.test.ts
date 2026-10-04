// WS-12 · release gate (old P6-10 #6, aceptacion-ux §11 "Lista de
// verificación antes de publicar"). Each §11 line maps to the tests that
// prove it, or says why it can't be automated (owner, Law, OPS). The gate
// fails when Law adds a line nobody mapped, or when a mapped test is
// renamed away. The manual lines are the PR checklist.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;

type Proof = [file: string, testTitlePrefix: string];
interface Line {
  /** Start of the §11 line, after "- [ ] ". */
  starts: string;
  tests: Proof[];
  /** What still needs a person; empty = fully automated. */
  manual?: string;
}

export const SECTION_11: Line[] = [
  {
    starts: 'Prueba de **7 días** solo en Pro mensual y Pro anual',
    tests: [
      ['trial-7d', '1–2 · 7 days'],
      ['trial-7d', '3 · the notice is due at trial start'],
      ['trial-7d', '4 · renewal windows unchanged'],
      ['billing-core', 'monthly renewal: 7 days before EVERY charge'],
      ['billing-core', 'annual renewal: 30 and 7 days before'],
      ['billing-core', 'monthly plans get one yearly summary'],
    ],
    manual:
      'Owner put the trial on EVERY plan (VIP too, PRICING.trial.plans); Law and Términos §2/§4.1 still say Pro only. Needs Law’s OK or a revert before LEGAL_PUBLISH.',
  },
  {
    starts: 'Aviso obligatorio no entregado',
    tests: [
      ['trial-7d', '7 · holdDecision: the five cases'],
      ['billing-core', 'bounced → hold until 5 days after an effective notice'],
      ['billing-core', 'a notice delivered too late'],
    ],
    manual:
      'MP pause/postpone of the first charge is unverified (OPS-14, MP_PAUSE_IN_TRIAL_VERIFIED=false).',
  },
  {
    starts: 'Casilla de consentimiento de cobro desmarcada y obligatoria',
    tests: [['trial-7d', '10 · checkbox unchecked by default']],
  },
  {
    starts: 'Monto total con IVA visible junto a la tarjeta',
    tests: [
      ['price-rules', 'prices are IVA-included totals by default'],
      ['price-rules', 'tax footer by billing country'],
      ['billing-core', 'the charge block renders Law’s examples exactly'],
    ],
    manual: 'IVA confirmed by the accountant (OPS-17, O-7).',
  },
  {
    starts: 'Razón social, domicilio, teléfono y correo visibles antes de pagar',
    tests: [['billing-core', 'seller identity: every field is required']],
    manual: 'LEGAL_ENTITY_* values on Vercel (OPS-10).',
  },
  {
    starts: 'Botón "Cancelar" visible en Mi cuenta → Mi plan',
    tests: [
      ['billing-core', 'cancelled keeps access until the period'],
      ['price-change', 'cancelling is never blocked'],
      ['legal', 're-accept: the modal never blocks cancelling'],
    ],
    manual:
      'e2e of the 1-confirmation cancel and the folio email against a preview (OPS-9 secrets).',
  },
  {
    starts: 'Aumento de precio a suscriptores actuales',
    tests: [
      ['price-change', 'the notice is EXACTLY 30 calendar days'],
      ['price-change', 'no charge at the new amount without an acceptance'],
    ],
    manual: 'Owner picks option (a)/(b) and fills Términos §5.3 (O-2, OPS-23).',
  },
  {
    starts: 'Precio tachado',
    tests: [['price-rules', 'reference price: off by default']],
    manual: 'Evidence checklist before SHOW_REFERENCE_PRICE (O-3, OPS-21).',
  },
  {
    starts: 'Pro Lealtad: calendario completo',
    tests: [
      ['pro-lealtad', '3 · checkout block and checkbox'],
      ['pro-lealtad', '6 · a mandatory notice 7 days before EVERY charge'],
      ['pro-lealtad', '8–11 · what resets'],
      ['refunds-chargebacks', 'a dispute on Pro Lealtad'],
    ],
    manual: 'LEALTAD_ENABLED stays off until OPS-14 (1), D21 and Law’s R items (OPS-24).',
  },
  {
    starts: 'Reembolsos: solo los casos legales',
    tests: [
      ['refunds-chargebacks', 'S.4 #1'],
      ['refunds-chargebacks', 'S.4 #2 · refund reasons'],
      ['refunds-chargebacks', 'S.4 #3'],
      ['refunds-chargebacks', 'S.4 #4'],
      ['refunds-chargebacks', 'S.4 #6'],
    ],
    manual: 'Law signs REVISION §S (S.3 1–9) before CHARGEBACK_MEASURES_ENABLED.',
  },
  {
    starts: 'Marketing desmarcado',
    tests: [],
    manual:
      'Unsubscribe link in every marketing email: there is no marketing email yet; check when one ships.',
  },
  {
    starts: 'Documentos versionados con URL fija y hash',
    tests: [
      ['legal', 'archive: each current version is Law’s file byte for byte'],
      ['legal', 'versioned URL: fixed /legal/<slug>/v<x-y>'],
      ['legal', 'routes: each document has its current page and its versioned page'],
    ],
  },
  {
    starts: 'Registro de evidencia append-only en producción',
    tests: [['billing-core', 'consent events chain and any edit breaks the chain']],
    manual:
      'Prod role has no UPDATE/DELETE on consent_events (OPS-2) and a simulated chargeback pack is pulled from prod data.',
  },
  {
    starts: 'Modal de riesgo en Señales, Pronósticos e Inversiones',
    tests: [['guardrails', 'no advice, copy-trading or betting words']],
    manual:
      'e2e: first activation of each tool shows the risk modal (Pronósticos and Inversiones are not live yet).',
  },
  {
    starts: 'Inversiones: solo reglas definidas por el usuario',
    tests: [
      ['guardrails', 'withdrawal keys are refused'],
      ['guardrails', 'a rule can only come from the user'],
    ],
  },
  {
    starts: 'Pronósticos: sin apuestas',
    tests: [['guardrails', 'no betting domain is linked from the code']],
    manual: 'Links only to SEGOB-licensed operators: content review when Pronósticos ships.',
  },
  {
    starts: 'Aviso y retirada',
    tests: [
      ['legal-p6', 'takedown: the four minimum fields'],
      ['legal-p6', 'takedown: one fingerprint per video'],
      ['legal-p6', 'takedown: a removed source is refused'],
      ['legal-p6', 'takedown: repeat infringers'],
    ],
    manual:
      'The repeat-infringer policy is still [POLÍTICA DE REINCIDENCIA] in Uso aceptable §5.4 (the code follows its example: 3 in 12 months, flagged for an admin to close); [CORREO DE DERECHOS DE AUTOR] → LEGAL_COPYRIGHT_EMAIL.',
  },
  {
    starts: 'Quebec: versión en francés antes de vender',
    tests: [
      ['billing-core', 'Quebec detection and block'],
      ['trial-7d', 'Quebec still blocks the trial and paid plans'],
    ],
  },
  {
    starts: 'Revisión de un abogado mexicano',
    tests: [['legal', 'publish gate: LEGAL_PUBLISH=true cannot take effect']],
    manual:
      'Attorney signature (and US/CA counsel for USD), OPS-10. The gate only proves nothing publishes before.',
  },
];

function section11(): string[] {
  const law = readFileSync(join(ROOT, 'docs/design/app-reimagine/legal/aceptacion-ux.md'), 'utf8');
  const body = law.slice(law.indexOf('## 11.'));
  return [...body.matchAll(/^- \[ \] (.+)$/gm)].map((m) => m[1]!);
}

test('§11: every line of Law’s pre-publication checklist is mapped', () => {
  const lines = section11();
  assert.ok(lines.length >= 19, 'checklist found');
  for (const line of lines) {
    assert.ok(
      SECTION_11.some((l) => line.startsWith(l.starts)),
      `unmapped §11 line: ${line.slice(0, 90)}`,
    );
  }
  for (const l of SECTION_11)
    assert.ok(
      lines.some((x) => x.startsWith(l.starts)),
      `stale mapping: ${l.starts}`,
    );
});

test('§11: every mapped proof is a test that exists', () => {
  const cache = new Map<string, string>();
  for (const l of SECTION_11) {
    assert.ok(l.tests.length > 0 || l.manual, l.starts);
    for (const [file, title] of l.tests) {
      if (!cache.has(file))
        cache.set(file, readFileSync(join(ROOT, `tests/${file}.test.ts`), 'utf8'));
      assert.ok(cache.get(file)!.includes(`test('${title}`), `${file}: "${title}"`);
    }
  }
});

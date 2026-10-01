'use server';

// Server actions for Asistente (P3-8), Inmuebles (P3-12) and Inversiones
// (P3-11).
// Each re-checks the plan and the hub mode; Inversiones also re-checks the
// risk notice and the two consents. Errors are codes, never engine text.

import { getLocale, getTranslations } from 'next-intl/server';
import { getSessionUser, type SessionUser } from '@/lib/auth/session';
import { getEntitlements } from '@/lib/billing/entitlement';
import { createAdminClient } from '@/lib/supabase/admin';
import { sealPersonal, consentEncryptionReady } from '@/lib/billing/consent-crypto';
import { withSelfIdentification } from '@/lib/guardrails/assistant';
import { decideKey, validateRule, type RuleCheck } from '@/lib/guardrails/invest';
import { getAsistente, getInmuebles, getInversiones, hubRunsTool } from './registry';
import { hasRiskAck, recordToolConsent } from './consents';
import type { AssistantChannel, AutomationRule, PropertyCard } from './adapters/tools';

async function gate<A>(slug: string, get: () => A | null): Promise<{ session: SessionUser; adapter: A } | null> {
  const session = await getSessionUser();
  if (!session) return null;
  const ent = await getEntitlements(session);
  const adapter = hubRunsTool(slug) ? get() : null;
  if (ent.tools[slug]?.state !== 'included' || !adapter) return null;
  return { session, adapter };
}

type Fail = { ok: false; code: string };

// ── Asistente ────────────────────────────────────────────────────────
export async function saveAssistant(input: {
  businessName: string;
  channel: AssistantChannel;
  knowledge: string;
}): Promise<{ ok: true } | Fail> {
  const g = await gate('chalybbot', getAsistente);
  if (!g) return { ok: false, code: 'NEEDS_PLAN' };
  const channels = await g.adapter.channels();
  const businessName = input.businessName.trim().slice(0, 80);
  const knowledge = input.knowledge.trim().slice(0, 8000);
  if (!businessName || !channels.includes(input.channel) || !knowledge) return { ok: false, code: 'INVALID' };
  await g.adapter.saveConfig(g.session.user.id, { businessName, channel: input.channel, knowledge });
  return { ok: true };
}

export async function testAssistant(message: string): Promise<{ ok: true; reply: string } | Fail> {
  const g = await gate('chalybbot', getAsistente);
  if (!g) return { ok: false, code: 'NEEDS_PLAN' };
  const cfg = await g.adapter.getConfig(g.session.user.id);
  if (!cfg) return { ok: false, code: 'INVALID' };
  const text = message.trim().slice(0, 500);
  if (!text) return { ok: false, code: 'INVALID' };
  const reply = await g.adapter.test(g.session.user.id, text);
  return { ok: true, reply: withSelfIdentification(reply, cfg.businessName, await getLocale()) };
}

// ── Inmuebles ────────────────────────────────────────────────────────
export async function createProperty(input: {
  title: string;
  details: string;
  photos: string;
}): Promise<{ ok: true; card: PropertyCard } | Fail> {
  const g = await gate('chalybrealtor', getInmuebles);
  if (!g) return { ok: false, code: 'NEEDS_PLAN' };
  const title = input.title.trim().slice(0, 120);
  const details = input.details.trim().slice(0, 4000);
  const photos = input.photos
    .split(/\s+/)
    .filter((u) => /^https:\/\/\S+$/.test(u))
    .slice(0, 20);
  if (!title || !details) return { ok: false, code: 'INVALID' };
  return { ok: true, card: await g.adapter.create(g.session.user.id, { title, details, photos }) };
}

// ── Inversiones ──────────────────────────────────────────────────────
export async function connectExchange(input: {
  exchange: string;
  apiKey: string;
  apiSecret: string;
  consentChecked: boolean;
}): Promise<{ ok: true } | Fail> {
  const g = await gate('chalybtrade', getInversiones);
  if (!g) return { ok: false, code: 'NEEDS_PLAN' };
  if (!(await hasRiskAck(g.session.user.id, 'chalybtrade'))) return { ok: false, code: 'RISK_ACK_REQUIRED' };
  if (input.consentChecked !== true) return { ok: false, code: 'CONSENT_REQUIRED' };
  if (!(await g.adapter.exchanges()).includes(input.exchange)) return { ok: false, code: 'INVALID' };
  const apiKey = input.apiKey.trim();
  const apiSecret = input.apiSecret.trim();
  if (apiKey.length < 8 || apiSecret.length < 8) return { ok: false, code: 'INVALID' };
  if (!consentEncryptionReady()) return { ok: false, code: 'TOOL_UNAVAILABLE' };

  // Withdrawal permission → refused before anything is stored.
  const perms = await g.adapter.checkPermissions({ exchange: input.exchange, apiKey, apiSecret });
  const decision = decideKey(perms);
  if (!decision.ok) return { ok: false, code: decision.reason === 'withdraw' ? 'KEY_WITHDRAW' : 'KEY_NO_READ' };

  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'invest.s1' });
  const event = await recordToolConsent(g.session, {
    type: 'financial_data_consent',
    surface: 'invest_connect',
    checkboxText: t('check'),
    buttonLabel: t('cta'),
    details: { tool: 'chalybtrade', exchange: input.exchange },
    locale,
  });
  const { error } = await createAdminClient()
    .from('exchange_connections')
    .upsert(
      {
        user_id: g.session.user.id,
        exchange: input.exchange,
        api_key_enc: sealPersonal(apiKey),
        api_secret_enc: sealPersonal(apiSecret),
        can_trade: perms.trade,
        consent_id: event.consent_id,
      },
      { onConflict: 'user_id,exchange' },
    );
  if (error) {
    console.error('[invest] could not store connection', error.message);
    return { ok: false, code: 'UNKNOWN' };
  }
  return { ok: true };
}

export async function activateRule(input: {
  draft: Record<string, unknown>;
  exchange: string;
  summary: string;
  confirmChecked: boolean;
}): Promise<{ ok: true; rule: AutomationRule } | Fail | { ok: false; code: 'INVALID'; errors: Exclude<RuleCheck, { ok: true }>['errors'] }> {
  const g = await gate('chalybtrade', getInversiones);
  if (!g) return { ok: false, code: 'NEEDS_PLAN' };
  const u = g.session.user.id;
  if (!(await hasRiskAck(u, 'chalybtrade'))) return { ok: false, code: 'RISK_ACK_REQUIRED' };
  if (input.confirmChecked !== true) return { ok: false, code: 'CONSENT_REQUIRED' };
  const { data: conn } = await createAdminClient()
    .from('exchange_connections')
    .select('exchange')
    .eq('user_id', u)
    .eq('exchange', input.exchange)
    .maybeSingle();
  if (!conn) return { ok: false, code: 'SETUP_NEEDED' };
  const check = validateRule(input.draft);
  if (!check.ok) return { ok: false, code: 'INVALID', errors: check.errors };

  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'invest.s3' });
  const rule: AutomationRule = { ...check.rule, id: crypto.randomUUID(), active: true, createdAt: new Date().toISOString() };
  await recordToolConsent(g.session, {
    type: 'automation_rule_activated',
    surface: 'invest_rule',
    checkboxText: t('check'),
    buttonLabel: t('activate'),
    details: {
      tool: 'chalybtrade',
      exchange: input.exchange,
      rule_id: rule.id,
      asset: rule.asset,
      side: rule.side,
      condition: rule.condition,
      max_amount_mxn: String(rule.maxAmount),
      schedule: rule.schedule,
    },
    locale,
  });
  await g.adapter.saveRule(u, rule);
  return { ok: true, rule };
}

export async function setRuleActive(ruleId: string, active: boolean): Promise<{ ok: true } | Fail> {
  const g = await gate('chalybtrade', getInversiones);
  if (!g) return { ok: false, code: 'NEEDS_PLAN' };
  // Pausing is always allowed; resuming needs the risk notice still current.
  if (active && !(await hasRiskAck(g.session.user.id, 'chalybtrade'))) return { ok: false, code: 'RISK_ACK_REQUIRED' };
  const own = (await g.adapter.rules(g.session.user.id)).some((r) => r.id === ruleId);
  if (!own) return { ok: false, code: 'INVALID' };
  await g.adapter.setActive(g.session.user.id, ruleId, active);
  return { ok: true };
}

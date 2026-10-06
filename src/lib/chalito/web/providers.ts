/** Onboarding's coding-agent choice (Onboarding.tsx re-exports this). */
export interface AgentOption {
  agent: 'claude-code' | 'codex' | 'grok-build' | 'gemini-cli';
  provider: 'anthropic' | 'openai' | 'xai' | 'google';
  auth: string[];
  /** providers.yaml `subscriptionLocal` for the provider (off | owner_only | on | approved). */
  subscription: string;
}

/**
 * Coding agents and their official auth paths: a snapshot of packages/config/providers.yaml in
 * picassoglitch/chalito (65294d9), with the owner's 2026-10-05 decisions (connect contract):
 * Claude plan sign-in owner_only (D-002), Gemini added with Google sign-in on. Update it from
 * there when that file changes.
 */
const AGENT_OPTIONS = [
  {
    agent: 'claude-code',
    provider: 'anthropic',
    auth: ['api_key', 'claude_plan'],
    subscription: 'owner_only',
  },
  {
    agent: 'codex',
    provider: 'openai',
    auth: ['api_key', 'chatgpt_plan'],
    subscription: 'owner_only',
  },
  {
    agent: 'grok-build',
    provider: 'xai',
    auth: ['api_key', 'grok_login'],
    subscription: 'on',
  },
  {
    agent: 'gemini-cli',
    provider: 'google',
    auth: ['api_key', 'google_login'],
    subscription: 'on',
  },
] as const;

export const agentOptions = (): AgentOption[] =>
  AGENT_OPTIONS.map((a) => ({ ...a, auth: [...a.auth] })) as AgentOption[];

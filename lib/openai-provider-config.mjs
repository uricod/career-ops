/**
 * Resolve first-class presets that use the OpenAI-compatible transport.
 *
 * The default remains fully generic. Provider presets only translate the
 * provider's native environment variables into the transport settings used by
 * openai-eval.mjs and openai-tailor.mjs; API keys are never logged or written.
 */

import { createHash } from 'crypto';

const DEFAULT_TIMEOUT_MS = '300000';

/**
 * Normalize a CLI/environment provider name.
 * @param {string|undefined|null} value
 * @returns {'openai-compatible'|'grok'}
 */
export function normalizeOpenAIProvider(value) {
  const normalized = String(value || 'openai-compatible').trim().toLowerCase();
  if (['openai', 'openai-compatible', 'compatible', 'custom'].includes(normalized)) {
    return 'openai-compatible';
  }
  if (['grok', 'xai', 'x.ai'].includes(normalized)) return 'grok';
  throw new Error(`Unknown AI provider "${value}". Supported providers: openai-compatible, grok.`);
}

/**
 * Resolve a provider preset from environment variables.
 * @param {object} [opts]
 * @param {string} [opts.provider]
 * @param {NodeJS.ProcessEnv|Record<string, string|undefined>} [opts.env]
 */
export function resolveOpenAIProviderConfig({ provider, env = process.env } = {}) {
  const id = normalizeOpenAIProvider(provider || env.CAREER_OPS_AI_PROVIDER);

  if (id === 'grok') {
    return {
      id,
      displayName: 'Grok (xAI)',
      tokenProvider: 'xai',
      apiKey: env.XAI_API_KEY || env.GROK_API_KEY || '',
      apiKeyEnv: 'XAI_API_KEY',
      baseUrl: env.XAI_BASE_URL || env.GROK_BASE_URL || 'https://api.x.ai/v1',
      model: env.XAI_MODEL || env.GROK_MODEL || 'grok-4.6',
      timeoutMs: env.XAI_TIMEOUT_MS || env.GROK_TIMEOUT_MS || env.OPENAI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS,
      maxContextTokens: 500_000,
    };
  }

  return {
    id,
    displayName: 'OpenAI-compatible',
    tokenProvider: 'openai',
    apiKey: env.OPENAI_API_KEY || '',
    apiKeyEnv: 'OPENAI_API_KEY',
    baseUrl: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: env.OPENAI_MODEL || 'gpt-4o-mini',
    timeoutMs: env.OPENAI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS,
    maxContextTokens: 128_000,
  };
}

/** @param {string} host */
export function isXaiHost(host) {
  const normalized = String(host || '').trim().toLowerCase();
  return normalized === 'api.x.ai' || normalized.endsWith('.api.x.ai');
}

/**
 * Stable, non-reversible routing key for xAI prompt-cache affinity.
 * @param {string} prompt
 */
export function xaiConversationId(prompt) {
  const digest = createHash('sha256').update(String(prompt || '')).digest('hex').slice(0, 32);
  return `career-ops-${digest}`;
}

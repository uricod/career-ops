import { execFileSync } from 'child_process';
import { join } from 'path';
import { fail, pass, ROOT, NODE } from './helpers.mjs';
import {
  isXaiHost, normalizeOpenAIProvider, resolveOpenAIProviderConfig, xaiConversationId,
} from '../lib/openai-provider-config.mjs';
import { estimateCost } from '../utils/token-tracker.mjs';

console.log('\nOpenAI-compatible transport — first-class Grok/xAI provider preset');

try {
  const cfg = resolveOpenAIProviderConfig({ provider: 'grok', env: {} });
  if (cfg.baseUrl === 'https://api.x.ai/v1' && cfg.model === 'grok-4.6' && cfg.apiKeyEnv === 'XAI_API_KEY') {
    pass('Grok preset uses the official xAI endpoint, model, and key variable');
  } else {
    fail(`Unexpected Grok defaults: ${JSON.stringify(cfg)}`);
  }

  const configured = resolveOpenAIProviderConfig({
    provider: 'xai',
    env: {
      XAI_API_KEY: 'native-key',
      GROK_API_KEY: 'alias-key',
      XAI_MODEL: 'grok-test',
      XAI_BASE_URL: 'https://example.x.ai/v1',
      XAI_TIMEOUT_MS: '1234',
    },
  });
  if (configured.apiKey === 'native-key' && configured.model === 'grok-test'
    && configured.baseUrl === 'https://example.x.ai/v1' && configured.timeoutMs === '1234') {
    pass('Native XAI_* settings override Grok aliases and defaults');
  } else {
    fail('Grok environment precedence is incorrect');
  }

  const generic = resolveOpenAIProviderConfig({ env: { OPENAI_MODEL: 'custom-model' } });
  if (generic.id === 'openai-compatible' && generic.model === 'custom-model') {
    pass('Existing generic OpenAI-compatible defaults remain unchanged');
  } else {
    fail('Generic provider settings regressed');
  }

  const envSelected = resolveOpenAIProviderConfig({ env: { CAREER_OPS_AI_PROVIDER: 'grok' } });
  if (envSelected.id === 'grok') {
    pass('CAREER_OPS_AI_PROVIDER can make Grok the default transport preset');
  } else {
    fail('Environment-selected Grok preset was ignored');
  }

  if (normalizeOpenAIProvider('x.ai') === 'grok' && isXaiHost('api.x.ai') && isXaiHost('mtls.api.x.ai')) {
    pass('xAI aliases and official API hosts are recognized');
  } else {
    fail('xAI alias or host recognition failed');
  }

  const secretPrompt = 'private CV text';
  const first = xaiConversationId(secretPrompt);
  const second = xaiConversationId(secretPrompt);
  if (first === second && first.startsWith('career-ops-') && !first.includes(secretPrompt)) {
    pass('xAI cache routing key is stable and does not expose prompt text');
  } else {
    fail('xAI cache routing key is unstable or leaks prompt text');
  }

  const cost = estimateCost('grok-4.6', { prompt_tokens: 1_000_000, completion_tokens: 1_000_000 }, 'xai');
  if (cost === 8) {
    pass('Token tracker recognizes Grok 4.6 input/output pricing');
  } else {
    fail(`Unexpected Grok 4.6 cost estimate: ${cost}`);
  }

  const help = execFileSync(NODE, [join(ROOT, 'openai-eval.mjs'), '--provider', 'grok', '--help'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
  if (help.includes('XAI_API_KEY') && help.includes('--provider grok') && help.includes('grok-4.6')) {
    pass('Evaluator exposes the Grok provider and native xAI environment variables');
  } else {
    fail('Evaluator Grok help is incomplete');
  }
} catch (err) {
  fail(`Grok provider preset tests crashed: ${err.message}`);
}

import assert from "node:assert/strict";
import test from "node:test";
import {
  communityResponseFields,
  estimatedMicrousd,
  resolveCommunityAiProvider,
} from "../src/lib/community/ai-provider.mjs";

test("Grok community provider uses native xAI settings and Responses API", () => {
  const provider = resolveCommunityAiProvider({
    CAREER_OPS_AI_PROVIDER: "grok",
    XAI_API_KEY: "secret",
  });
  assert.equal(provider.id, "grok");
  assert.equal(provider.configured, true);
  assert.equal(provider.model, "grok-4.6");
  assert.equal(provider.responsesUrl, "https://api.x.ai/v1/responses");
});

test("an XAI key selects Grok when no provider is explicit", () => {
  assert.equal(resolveCommunityAiProvider({ XAI_API_KEY: "secret" }).id, "grok");
});

test("Grok Responses requests use supported low reasoning and cache affinity", () => {
  const fields = communityResponseFields({ id: "grok" }, {
    promptCacheKey: "stable-cache-key",
    safetyIdentifier: "not-sent-to-xai",
  });
  assert.deepEqual(fields, {
    reasoning: { effort: "low" },
    prompt_cache_key: "stable-cache-key",
  });
});

test("OpenAI keeps its non-reasoning and safety identifier fields", () => {
  const fields = communityResponseFields({ id: "openai" }, {
    promptCacheKey: "not-sent-to-openai",
    safetyIdentifier: "user-hash",
  });
  assert.deepEqual(fields, {
    reasoning: { effort: "none" },
    safety_identifier: "user-hash",
  });
});

test("provider-specific rates produce micro-USD estimates", () => {
  const provider = resolveCommunityAiProvider({
    CAREER_OPS_AI_PROVIDER: "grok",
    XAI_API_KEY: "secret",
  });
  assert.equal(estimatedMicrousd(provider, 1_000, 500), 5_000);
});

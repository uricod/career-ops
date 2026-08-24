const OPENAI_BASE_URL = "https://api.openai.com/v1";
const XAI_BASE_URL = "https://api.x.ai/v1";

function cleanBaseUrl(value, fallback) {
  try {
    const parsed = new URL(String(value || fallback));
    if (parsed.protocol !== "https:") return fallback;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function normalizeCommunityAiProvider(value) {
  const normalized = String(value || "openai").trim().toLowerCase();
  if (["grok", "xai", "x.ai"].includes(normalized)) return "grok";
  return "openai";
}

export function resolveCommunityAiProvider(env = process.env) {
  const inferred = env.CAREER_OPS_AI_PROVIDER || (env.XAI_API_KEY ? "grok" : "openai");
  const id = normalizeCommunityAiProvider(inferred);
  if (id === "grok") {
    const apiKey = String(env.XAI_API_KEY || env.GROK_API_KEY || "").trim();
    const baseUrl = cleanBaseUrl(env.XAI_BASE_URL || env.GROK_BASE_URL, XAI_BASE_URL);
    return {
      id,
      displayName: "Grok (xAI)",
      configured: Boolean(apiKey),
      apiKey,
      model: String(env.XAI_MODEL || env.GROK_MODEL || "grok-4.6").trim(),
      responsesUrl: `${baseUrl}/responses`,
      inputUsdPerMtok: positiveNumber(env.XAI_INPUT_USD_PER_MTOK, 2),
      outputUsdPerMtok: positiveNumber(env.XAI_OUTPUT_USD_PER_MTOK, 6),
    };
  }

  const apiKey = String(env.OPENAI_API_KEY || "").trim();
  const baseUrl = cleanBaseUrl(env.OPENAI_BASE_URL, OPENAI_BASE_URL);
  return {
    id,
    displayName: "OpenAI",
    configured: Boolean(apiKey),
    apiKey,
    model: String(env.OPENAI_MODEL || "gpt-5.6-luna").trim(),
    responsesUrl: `${baseUrl}/responses`,
    inputUsdPerMtok: positiveNumber(env.OPENAI_INPUT_USD_PER_MTOK, 0.2),
    outputUsdPerMtok: positiveNumber(env.OPENAI_OUTPUT_USD_PER_MTOK, 1.2),
  };
}

export function communityResponseFields(provider, { promptCacheKey, safetyIdentifier } = {}) {
  if (provider?.id === "grok") {
    return {
      reasoning: { effort: "low" },
      ...(promptCacheKey ? { prompt_cache_key: promptCacheKey } : {}),
    };
  }
  return {
    reasoning: { effort: "none" },
    ...(safetyIdentifier ? { safety_identifier: safetyIdentifier } : {}),
  };
}

export function estimatedMicrousd(provider, inputTokens, outputTokens) {
  return Math.max(
    0,
    Math.round(
      Number(inputTokens || 0) * Number(provider?.inputUsdPerMtok || 0) +
        Number(outputTokens || 0) * Number(provider?.outputUsdPerMtok || 0),
    ),
  );
}

import { createClient } from "@supabase/supabase-js";
import {
  getCommunityServerSecret,
  getCommunityServiceClient,
} from "@/lib/community/supabase-server";
import {
  publicSiteUrl,
  supabasePublishableKey,
} from "@/lib/community/config";
import {
  clientAddress,
  isInvitationEmail,
  isSameOriginMutation,
  privateJson,
  rateLimitKey,
} from "@/lib/community/security.mjs";

export const runtime = "nodejs";

async function consumeLimit(
  service: NonNullable<ReturnType<typeof getCommunityServiceClient>>,
  keyHash: string,
  limit: number,
) {
  const { data, error } = await service.rpc("consume_auth_attempt", {
    p_key_hash: keyHash,
    p_limit: limit,
    p_window_seconds: 900,
  });
  const result = Array.isArray(data) ? data[0] : data;
  if (error || !result) return { unavailable: true, allowed: false, retry: 0 };
  return {
    unavailable: false,
    allowed: result.allowed === true,
    retry: Math.max(1, Number(result.retry_after_seconds || 1)),
  };
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request))
    return privateJson({ error: "Request origin rejected." }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid request." }, 400);
  }
  const email = String(body.email || "").trim().toLowerCase();
  if (!isInvitationEmail(email))
    return privateJson({ error: "Enter a valid member email." }, 400);

  const service = getCommunityServiceClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = supabasePublishableKey();
  const limitSecret =
    process.env.COMMUNITY_RATE_LIMIT_SECRET || getCommunityServerSecret();
  if (!service || !supabaseUrl || !publishableKey || !limitSecret)
    return privateJson({ error: "Password recovery is not configured." }, 503);

  const address = clientAddress(request);
  const [addressLimit, identityLimit] = await Promise.all([
    consumeLimit(service, rateLimitKey(limitSecret, "reset-ip", address), 20),
    consumeLimit(
      service,
      rateLimitKey(limitSecret, "reset-identity", address, email),
      4,
    ),
  ]);
  if (addressLimit.unavailable || identityLimit.unavailable)
    return privateJson(
      { error: "Password recovery is temporarily unavailable." },
      503,
    );
  if (!addressLimit.allowed || !identityLimit.allowed) {
    const retry = Math.max(addressLimit.retry, identityLimit.retry);
    return privateJson({ error: "Too many attempts. Try again later." }, 429, {
      "Retry-After": String(retry),
    });
  }

  const callback = new URL("/auth/complete", publicSiteUrl());
  callback.searchParams.set("mode", "recovery");
  const auth = createClient(supabaseUrl, publishableKey, {
    auth: {
      flowType: "implicit",
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const { error } = await auth.auth.resetPasswordForEmail(email, {
    redirectTo: callback.toString(),
  });
  if (error) {
    // Keep the public response identical for existing and unknown addresses.
    console.error("[community-password-reset] provider rejected delivery");
  }
  return privateJson({ ok: true });
}

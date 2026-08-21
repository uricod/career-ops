import { createHash } from "node:crypto";
import {
  getCommunityServerSecret,
  getCommunityServiceClient,
  getSupabaseServerClient,
} from "@/lib/community/supabase-server";
import { publicSiteUrl } from "@/lib/community/config";
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

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const invite = String(body.invite || "").trim();
  if (!isInvitationEmail(email))
    return privateJson({ error: "Enter the invited email." }, 400);
  if (invite.length < 24 || invite.length > 200)
    return privateJson({ error: "Enter a valid invitation code." }, 400);

  const service = getCommunityServiceClient();
  const supabase = await getSupabaseServerClient();
  const limitSecret =
    process.env.COMMUNITY_RATE_LIMIT_SECRET || getCommunityServerSecret();
  if (
    !service ||
    !supabase ||
    !limitSecret
  )
    return privateJson({ error: "Invitation service is not configured." }, 503);

  const address = clientAddress(request);
  const [addressLimit, identityLimit] = await Promise.all([
    consumeLimit(service, rateLimitKey(limitSecret, "auth-ip", address), 30),
    consumeLimit(
      service,
      rateLimitKey(limitSecret, "auth-identity", address, email),
      6,
    ),
  ]);
  if (addressLimit.unavailable || identityLimit.unavailable)
    return privateJson(
      { error: "Invitation checks are temporarily unavailable." },
      503,
    );
  if (!addressLimit.allowed || !identityLimit.allowed) {
    const retry = Math.max(addressLimit.retry, identityLimit.retry);
    return privateJson({ error: "Too many attempts. Try again later." }, 429, {
      "Retry-After": String(retry),
    });
  }

  const codeHash = createHash("sha256").update(invite).digest("hex");
  const { data: invitation } = await service
    .from("invitations")
    .select("id,email,status,expires_at,redeemed_by")
    .eq("code_hash", codeHash)
    .eq("email", email)
    .maybeSingle();

  let returningMember = false;
  if (invitation?.status === "redeemed" && invitation.redeemed_by) {
    const { data: profile } = await service
      .from("profiles")
      .select("membership_status")
      .eq("id", invitation.redeemed_by)
      .maybeSingle();
    returningMember = profile?.membership_status === "active";
  }

  const pendingInvite =
    invitation?.status === "pending" &&
    new Date(invitation.expires_at).getTime() > Date.now();
  if (!pendingInvite && !returningMember) {
    if (invitation?.status === "pending")
      await service
        .from("invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);
    return privateJson({ error: "That invitation is unavailable." }, 403);
  }

  const callback = new URL("/auth/callback", publicSiteUrl());
  if (pendingInvite) callback.searchParams.set("invite", invite);
  callback.searchParams.set("next", "/community");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: callback.toString() },
  });
  if (error)
    return privateJson(
      { error: "The private sign-in link could not be sent." },
      502,
    );

  return privateJson({ ok: true });
}

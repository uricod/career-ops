import { createHash } from "node:crypto";
import {
  getCommunityServerSecret,
  getCommunityServiceClient,
} from "@/lib/community/supabase-server";
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
  const password = String(body.password || "");
  if (!isInvitationEmail(email) || invite.length < 24 || invite.length > 200)
    return privateJson({ error: "That invitation is unavailable." }, 403);
  if (password.length < 12 || password.length > 72)
    return privateJson(
      { error: "Use a password between 12 and 72 characters." },
      400,
    );

  const service = getCommunityServiceClient();
  const limitSecret =
    process.env.COMMUNITY_RATE_LIMIT_SECRET || getCommunityServerSecret();
  if (!service || !limitSecret)
    return privateJson({ error: "Invitation service is not configured." }, 503);

  const address = clientAddress(request);
  const [addressLimit, identityLimit] = await Promise.all([
    consumeLimit(service, rateLimitKey(limitSecret, "activate-ip", address), 20),
    consumeLimit(
      service,
      rateLimitKey(limitSecret, "activate-identity", address, email),
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
    .select("id,status,expires_at")
    .eq("code_hash", codeHash)
    .eq("email", email)
    .maybeSingle();
  const usable =
    invitation?.status === "pending" &&
    new Date(invitation.expires_at).getTime() > Date.now();
  if (!usable) {
    if (invitation?.status === "pending")
      await service
        .from("invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);
    return privateJson({ error: "That invitation is unavailable." }, 403);
  }

  let memberId = "";
  for (let page = 1; page <= 50 && !memberId; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error)
      return privateJson({ error: "Could not prepare the account." }, 502);
    memberId =
      data.users.find((user) => user.email?.toLowerCase() === email)?.id || "";
    if (data.users.length < 200) break;
  }
  if (!memberId)
    return privateJson({ error: "That invitation is unavailable." }, 403);

  // Supabase hashes the password. The application never stores or logs it.
  // Possession of the high-entropy, expiring invitation is the account's
  // first-access credential; membership is activated only after sign-in.
  const { error: updateError } = await service.auth.admin.updateUserById(
    memberId,
    { password, email_confirm: true },
  );
  if (updateError)
    return privateJson({ error: "Could not prepare the account." }, 502);

  return privateJson({ ok: true });
}

import { createHash, randomBytes } from "node:crypto";
import {
  getCommunityMembership,
  getCommunityServiceClient,
} from "@/lib/community/supabase-server";
import { publicSiteUrl } from "@/lib/community/config";

export const runtime = "nodejs";

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.round(parsed)));
}

async function adminContext() {
  const membership = await getCommunityMembership();
  if (!membership.active || !membership.admin) return null;
  const service = getCommunityServiceClient();
  if (!service) return null;
  return { ...membership, service };
}

export async function POST(request: Request) {
  const context = await adminContext();
  if (!context)
    return Response.json({ error: "Admin access required." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const dailyTokenLimit = boundedInteger(
    body.dailyTokenLimit,
    20_000,
    0,
    100_000,
  );
  const expiresInDays = boundedInteger(body.expiresInDays, 7, 1, 30);
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320)
    return Response.json({ error: "Enter a valid email." }, { status: 400 });

  const { data: pending } = await context.service
    .from("invitations")
    .select("id")
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (pending)
    return Response.json(
      { error: "This email already has a pending invitation." },
      { status: 409 },
    );

  const { data: usersPage, error: listError } =
    await context.service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError)
    return Response.json(
      { error: "Could not inspect members." },
      { status: 502 },
    );
  let member = usersPage.users.find(
    (candidate) => candidate.email?.toLowerCase() === email,
  );
  if (!member) {
    const { data, error } = await context.service.auth.admin.createUser({
      email,
      email_confirm: false,
      app_metadata: { invited: true },
    });
    if (error || !data.user)
      return Response.json(
        { error: "Could not prepare the invited account." },
        { status: 502 },
      );
    member = data.user;
  } else {
    const { data: existingProfile } = await context.service
      .from("profiles")
      .select("membership_status")
      .eq("id", member.id)
      .maybeSingle();
    if (existingProfile?.membership_status === "active")
      return Response.json(
        { error: "This email already belongs to an active member." },
        { status: 409 },
      );
    await context.service.auth.admin.updateUserById(member.id, {
      app_metadata: { ...member.app_metadata, invited: true },
    });
    await context.service
      .from("profiles")
      .update({ membership_status: "invited" })
      .eq("id", member.id);
  }

  const code = randomBytes(32).toString("base64url");
  const codeHash = createHash("sha256").update(code).digest("hex");
  const expiresAt = new Date(
    Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: invitation, error: insertError } = await context.service
    .from("invitations")
    .insert({
      email,
      code_hash: codeHash,
      daily_token_limit: dailyTokenLimit,
      created_by: context.user!.id,
      expires_at: expiresAt,
    })
    .select("id,email,status,daily_token_limit,expires_at,created_at")
    .single();
  if (insertError)
    return Response.json(
      { error: "Could not create the invitation." },
      { status: 502 },
    );

  const inviteUrl = new URL("/login", publicSiteUrl());
  inviteUrl.searchParams.set("invite", code);
  inviteUrl.searchParams.set("email", email);
  return Response.json({ invitation, inviteUrl: inviteUrl.toString(), code });
}

export async function PATCH(request: Request) {
  const context = await adminContext();
  if (!context)
    return Response.json({ error: "Admin access required." }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.action === "revoke") {
    const invitationId = String(body.invitationId || "");
    const { error } = await context.service
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", invitationId)
      .eq("status", "pending");
    return error
      ? Response.json(
          { error: "Could not revoke invitation." },
          { status: 502 },
        )
      : Response.json({ ok: true });
  }

  if (body.action === "member") {
    const userId = String(body.userId || "");
    const membershipStatus = String(body.membershipStatus || "");
    const dailyTokenLimit = boundedInteger(body.dailyTokenLimit, 0, 0, 100_000);
    if (!/^[0-9a-f-]{36}$/i.test(userId))
      return Response.json({ error: "Invalid member." }, { status: 400 });
    if (!new Set(["active", "suspended"]).has(membershipStatus))
      return Response.json(
        { error: "Invalid member status." },
        { status: 400 },
      );
    const { error } = await context.service
      .from("profiles")
      .update({
        membership_status: membershipStatus,
        daily_token_limit: dailyTokenLimit,
      })
      .eq("id", userId);
    return error
      ? Response.json({ error: "Could not update member." }, { status: 502 })
      : Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown action." }, { status: 400 });
}

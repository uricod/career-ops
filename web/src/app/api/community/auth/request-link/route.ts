import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getCommunityServiceClient } from "@/lib/community/supabase-server";
import { publicSiteUrl } from "@/lib/community/config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const invite = String(body.invite || "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320)
    return Response.json(
      { error: "Enter the invited email." },
      { status: 400 },
    );
  if (invite.length < 24 || invite.length > 200)
    return Response.json(
      { error: "Enter a valid invitation code." },
      { status: 400 },
    );

  const service = getCommunityServiceClient();
  if (
    !service ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    return Response.json(
      { error: "Invitation service is not configured." },
      { status: 503 },
    );

  const codeHash = createHash("sha256").update(invite).digest("hex");
  const { data: invitation } = await service
    .from("invitations")
    .select("id,email,status,expires_at")
    .eq("code_hash", codeHash)
    .eq("email", email)
    .maybeSingle();

  if (
    !invitation ||
    invitation.status !== "pending" ||
    new Date(invitation.expires_at).getTime() <= Date.now()
  ) {
    if (invitation?.status === "pending")
      await service
        .from("invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);
    return Response.json(
      { error: "That invitation is unavailable." },
      { status: 403 },
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const callback = new URL("/auth/callback", publicSiteUrl());
  callback.searchParams.set("invite", invite);
  callback.searchParams.set("next", "/community");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: callback.toString() },
  });
  if (error)
    return Response.json(
      { error: "The private sign-in link could not be sent." },
      { status: 502 },
    );

  return Response.json({ ok: true });
}

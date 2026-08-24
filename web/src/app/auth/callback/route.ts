import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/community/supabase-server";
import { safeCommunityPath } from "@/lib/community/security.mjs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tokenType = url.searchParams.get("type");
  const recovery =
    tokenType === "recovery" || url.searchParams.get("mode") === "recovery";
  const invite = url.searchParams.get("invite");
  const next = safeCommunityPath(url.searchParams.get("next"));
  const supabase = await getSupabaseServerClient();
  const emailTokenType =
    tokenType === "email"
      ? "email"
      : tokenType === "magiclink"
        ? "magiclink"
        : tokenType === "recovery"
          ? "recovery"
          : null;
  if (supabase && (code || (tokenHash && emailTokenType))) {
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({
          token_hash: tokenHash!,
          type: emailTokenType!,
        });
    if (!error) {
      if (recovery) {
        const { data: active, error: activeError } = await supabase.rpc(
          "is_active_member",
        );
        if (!activeError && active === true)
          return privateRedirect(new URL("/auth/reset-password", url.origin));
      } else if (invite) {
        const { data: redeemed, error: redeemError } = await supabase.rpc(
          "redeem_invitation",
          { p_code: invite },
        );
        if (!redeemError && redeemed === true)
          return privateRedirect(new URL(next, url.origin));
      } else {
        const { data: active, error: activeError } = await supabase.rpc(
          "is_active_member",
        );
        if (!activeError && active === true)
          return privateRedirect(new URL(next, url.origin));
      }
    }
    await supabase.auth.signOut();
    if (error)
      return privateRedirect(new URL("/login?error=auth", url.origin));
  }
  return privateRedirect(new URL("/login?error=invite", url.origin));
}

function privateRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

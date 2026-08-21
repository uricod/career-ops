import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/community/supabase-server";
import { safeCommunityPath } from "@/lib/community/security.mjs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tokenType = url.searchParams.get("type");
  const invite = url.searchParams.get("invite");
  const next = safeCommunityPath(url.searchParams.get("next"));
  const supabase = await getSupabaseServerClient();
  if (supabase && (code || (tokenHash && tokenType === "magiclink"))) {
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({
          token_hash: tokenHash!,
          type: "magiclink",
        });
    if (!error) {
      if (invite) {
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
  }
  return privateRedirect(new URL("/login?error=invite", url.origin));
}

function privateRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

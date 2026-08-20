import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/community/supabase-server";
import { safeCommunityPath } from "@/lib/community/security.mjs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const invite = url.searchParams.get("invite");
  const next = safeCommunityPath(url.searchParams.get("next"));
  const supabase = await getSupabaseServerClient();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && invite) {
      const { data: redeemed, error: redeemError } = await supabase.rpc(
        "redeem_invitation",
        { p_code: invite },
      );
      if (!redeemError && redeemed === true)
        return privateRedirect(new URL(next, url.origin));
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

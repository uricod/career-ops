import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/community/supabase-server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const invite = url.searchParams.get("invite");
  const requested = url.searchParams.get("next") || "/community";
  const next =
    requested.startsWith("/") && !requested.startsWith("//")
      ? requested
      : "/community";
  const supabase = await getSupabaseServerClient();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && invite) {
      const { data: redeemed, error: redeemError } = await supabase.rpc(
        "redeem_invitation",
        { p_code: invite },
      );
      if (!redeemError && redeemed === true)
        return NextResponse.redirect(new URL(next, url.origin));
    }
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/login?error=invite", url.origin));
}

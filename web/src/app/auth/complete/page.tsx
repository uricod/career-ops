"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/community/supabase-browser";
import { safeCommunityPath } from "@/lib/community/security.mjs";

export default function CompleteSignInPage() {
  const [message, setMessage] = useState("Securing your private session…");

  useEffect(() => {
    let active = true;

    async function complete() {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");
      const query = new URLSearchParams(window.location.search);
      const invite = query.get("invite");
      const recovery = query.get("mode") === "recovery";
      const next = safeCommunityPath(query.get("next"));

      // Never leave bearer tokens in browser history longer than necessary.
      window.history.replaceState({}, "", window.location.pathname);

      const supabase = getSupabaseBrowserClient();
      if (!supabase || !accessToken || !refreshToken) {
        window.location.replace("/login?error=auth");
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) {
        window.location.replace("/login?error=auth");
        return;
      }

      let allowed = false;
      if (invite) {
        const { data, error } = await supabase.rpc("redeem_invitation", {
          p_code: invite,
        });
        allowed = !error && data === true;
      } else {
        const { data, error } = await supabase.rpc("is_active_member");
        allowed = !error && data === true;
      }

      if (!allowed) {
        await supabase.auth.signOut();
        window.location.replace("/login?error=invite");
        return;
      }

      if (recovery) {
        if (active) setMessage("Recovery link verified. Opening password reset…");
        window.location.replace("/auth/reset-password");
        return;
      }
      if (active) setMessage("Welcome back. Opening The Commons…");
      window.location.replace(next);
    }

    void complete().catch(() => {
      window.location.replace("/login?error=auth");
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f2ed] px-6 text-[#181815] dark:bg-[#10100f] dark:text-[#f2f0e9]">
      <div className="text-center">
        <LoaderCircle className="mx-auto size-6 animate-spin" />
        <p className="mt-4 text-sm text-black/55 dark:text-white/55">
          {message}
        </p>
      </div>
    </main>
  );
}

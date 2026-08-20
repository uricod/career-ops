"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Settings2, UserRound } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/community/supabase-browser";

export function CommunityAuthButton() {
  const [signedIn, setSignedIn] = useState(false);
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      setAdmin(data.session?.user.app_metadata?.role === "admin");
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      setAdmin(session?.user.app_metadata?.role === "admin");
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return signedIn ? (
    <div className="flex items-center gap-1">
      {admin && (
        <Link
          href="/community/admin"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-muted hover:bg-surface hover:text-foreground"
        >
          <Settings2 className="size-3.5" /> Admin
        </Link>
      )}
      <Link
        href="/community/profile"
        className="inline-flex size-9 items-center justify-center rounded-lg bg-foreground text-background transition hover:opacity-85"
        aria-label="Account"
      >
        <UserRound className="size-4" />
      </Link>
    </div>
  ) : (
    <Link
      href="/login"
      className="inline-flex min-h-10 items-center rounded-full bg-foreground px-4 text-sm font-semibold text-background transition hover:opacity-85"
    >
      Sign in
    </Link>
  );
}

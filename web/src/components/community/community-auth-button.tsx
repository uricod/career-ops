"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/community/supabase-browser";

export function CommunityAuthButton() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    void supabase.auth
      .getSession()
      .then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setSignedIn(Boolean(session)),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  return signedIn ? (
    <Link
      href="/community/profile"
      className="inline-flex min-h-10 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-background transition hover:opacity-85"
    >
      <UserRound className="size-4" />
      Account
    </Link>
  ) : (
    <Link
      href="/login"
      className="inline-flex min-h-10 items-center rounded-full bg-foreground px-4 text-sm font-semibold text-background transition hover:opacity-85"
    >
      Sign in
    </Link>
  );
}

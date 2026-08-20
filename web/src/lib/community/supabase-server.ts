import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isSupabaseConfigured } from "./config";

export async function getSupabaseServerClient() {
  if (!isSupabaseConfigured()) return null;
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot always set cookies; src/proxy.ts refreshes sessions.
          }
        },
      },
    },
  );
}

export async function getCommunityUser() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { supabase: null, user: null };
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user ?? null };
}

export async function getCommunityMembership() {
  const { supabase, user } = await getCommunityUser();
  if (!supabase || !user)
    return { supabase, user, profile: null, active: false, admin: false };
  const { data: profile } = await supabase
    .from("profiles")
    .select("membership_status,daily_token_limit")
    .eq("id", user.id)
    .maybeSingle();
  return {
    supabase,
    user,
    profile,
    active: profile?.membership_status === "active",
    admin: user.app_metadata?.role === "admin",
  };
}

export function getCommunityServiceClient() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isSupabaseConfigured, supabasePublishableKey } from "./config";

export function getCommunityServerSecret() {
  return (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

export async function getSupabaseServerClient() {
  if (!isSupabaseConfigured()) return null;
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabasePublishableKey(),
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
    .select("membership_status,daily_token_limit,locations")
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
  const secretKey = getCommunityServerSecret();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !secretKey) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

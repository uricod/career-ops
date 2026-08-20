export const COMMUNITY_MODE =
  process.env.NEXT_PUBLIC_CAREER_OPS_MODE === "community";

export const COMMUNITY_NAME =
  process.env.NEXT_PUBLIC_COMMUNITY_NAME || "Career Ops Community";
export const DEFAULT_DAILY_TOKEN_LIMIT = Number(
  process.env.NEXT_PUBLIC_COMMUNITY_DAILY_TOKEN_LIMIT || 20_000,
);

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function publicSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL)
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.NEXT_PUBLIC_VERCEL_URL)
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  return "http://localhost:3000";
}

import { BarChart3, Coins, ShieldAlert, Users } from "lucide-react";
import { getCommunityUser } from "@/lib/community/supabase-server";

export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const { supabase, user } = await getCommunityUser();
  let summary: {
    member_count: number;
    request_count: number;
    total_tokens: number;
    estimated_microusd: number;
  } | null = null;
  if (supabase && user) {
    const { data } = await supabase.rpc("admin_usage_summary", { p_days: 30 });
    summary = Array.isArray(data) ? data[0] : data;
  }
  if (!summary)
    return (
      <div className="mx-auto max-w-3xl px-5 py-20">
        <ShieldAlert className="size-8 text-brand" />
        <h1 className="mt-5 font-serif text-4xl text-landing">
          Nonprofit admin
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          This aggregate-only view requires an authenticated user with{" "}
          <code className="rounded bg-surface px-1.5 py-0.5">
            app_metadata.role=admin
          </code>
          . Member resumes, job descriptions, prompts, and model answers are
          never available here.
        </p>
      </div>
    );
  const cost = Number(summary.estimated_microusd || 0) / 1_000_000;
  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-brand-text">
        Last 30 days · aggregate only
      </p>
      <h1 className="mt-2 font-serif text-5xl text-landing">Nonprofit admin</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Tile
          icon={Users}
          label="Members"
          value={Number(summary.member_count).toLocaleString()}
        />
        <Tile
          icon={BarChart3}
          label="AI requests"
          value={Number(summary.request_count).toLocaleString()}
        />
        <Tile
          icon={Coins}
          label="Estimated model cost"
          value={`$${cost.toFixed(2)}`}
        />
      </div>
      <div className="mt-6 rounded-3xl border border-border bg-surface p-6">
        <h2 className="font-semibold">Budget posture</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {Number(summary.total_tokens).toLocaleString()} total tokens were
          used. Limits are enforced before model calls through atomic daily
          reservations, then reconciled to actual usage.
        </p>
      </div>
    </div>
  );
}
function Tile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-6">
      <Icon className="size-5 text-brand" />
      <div className="mt-5 text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  );
}

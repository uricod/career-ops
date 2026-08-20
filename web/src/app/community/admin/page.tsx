import { notFound } from "next/navigation";
import { Activity, Coins, Users } from "lucide-react";
import { AdminConsole } from "@/components/community/admin-console";
import {
  getCommunityMembership,
  getCommunityServiceClient,
} from "@/lib/community/supabase-server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const membership = await getCommunityMembership();
  if (!membership.active || !membership.admin || !membership.supabase)
    notFound();
  const service = getCommunityServiceClient();
  if (!service) notFound();

  const [{ data: invitations }, { data: profiles }, usersPage, summaryResult] =
    await Promise.all([
      service
        .from("invitations")
        .select("id,email,status,daily_token_limit,expires_at,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      service
        .from("profiles")
        .select("id,membership_status,daily_token_limit,created_at")
        .order("created_at", { ascending: false }),
      service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      membership.supabase.rpc("admin_usage_summary", { p_days: 30 }),
    ]);
  const emails = new Map(
    (usersPage.data?.users || []).map((user) => [user.id, user.email || ""]),
  );
  const members = (profiles || []).map((profile) => ({
    ...profile,
    email: emails.get(profile.id) || "Unknown member",
  }));
  const summary = Array.isArray(summaryResult.data)
    ? summaryResult.data[0]
    : summaryResult.data;
  const cost = Number(summary?.estimated_microusd || 0) / 1_000_000;

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 pb-28 sm:px-8">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-faint">
        Administration
      </p>
      <h1 className="mt-3 font-serif text-5xl text-landing">
        Community control
      </h1>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Stat
          icon={Users}
          label="Members"
          value={String(summary?.member_count || 0)}
        />
        <Stat
          icon={Activity}
          label="Requests · 30d"
          value={String(summary?.request_count || 0)}
        />
        <Stat
          icon={Coins}
          label="Estimated cost · 30d"
          value={`$${cost.toFixed(2)}`}
        />
      </div>
      <div className="mt-12">
        <AdminConsole invitations={invitations || []} members={members} />
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <Icon className="size-4 text-faint" />
      <p className="mt-5 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}

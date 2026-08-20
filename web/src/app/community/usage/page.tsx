import Link from "next/link";
import {
  Activity,
  CalendarClock,
  Coins,
  Gauge,
  LockKeyhole,
} from "lucide-react";
import { getCommunityUser } from "@/lib/community/supabase-server";
import { DEFAULT_DAILY_TOKEN_LIMIT } from "@/lib/community/config";

export const dynamic = "force-dynamic";
export default async function UsagePage() {
  const { supabase, user } = await getCommunityUser();
  let bucket: {
    used_tokens: number;
    reserved_tokens: number;
    request_count: number;
  } | null = null;
  let events: Array<{
    id: string;
    operation: string;
    model: string;
    total_tokens: number;
    estimated_microusd: number;
    status: string;
    created_at: string;
  }> = [];
  let limit = DEFAULT_DAILY_TOKEN_LIMIT;
  if (supabase && user) {
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: b }, { data: e }, { data: p }] = await Promise.all([
      supabase
        .from("usage_buckets")
        .select("used_tokens,reserved_tokens,request_count")
        .eq("usage_day", today)
        .maybeSingle(),
      supabase
        .from("usage_events")
        .select(
          "id,operation,model,total_tokens,estimated_microusd,status,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("profiles").select("daily_token_limit").single(),
    ]);
    bucket = b;
    events = e ?? [];
    limit = p?.daily_token_limit ?? limit;
  }
  const used = bucket?.used_tokens ?? 0;
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const cost =
    events.reduce((n, e) => n + Number(e.estimated_microusd || 0), 0) /
    1_000_000;
  return (
    <div className="mx-auto max-w-5xl px-5 py-10 pb-28 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-brand-text">
        Transparent by default
      </p>
      <h1 className="mt-2 font-serif text-5xl text-landing">Usage</h1>
      <p className="mt-3 text-sm text-muted">
        Your daily allowance protects a shared nonprofit budget. Job search and
        tracking stay free when the meter is full.
      </p>
      {!user && supabase && (
        <div className="mt-6 rounded-2xl bg-brand-soft p-4 text-sm text-brand-text">
          <Link href="/login" className="font-semibold underline">
            Sign in
          </Link>{" "}
          to see your private usage.
        </div>
      )}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat
          icon={Gauge}
          label="Used today"
          value={used.toLocaleString()}
          suffix={` / ${limit.toLocaleString()} tokens`}
        />
        <Stat
          icon={Activity}
          label="Requests today"
          value={String(bucket?.request_count ?? 0)}
          suffix=" completed or attempted"
        />
        <Stat
          icon={Coins}
          label="Estimated cost"
          value={`$${cost.toFixed(4)}`}
          suffix=" recent requests"
        />
      </div>
      <div className="mt-5 rounded-3xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Daily allowance</span>
          <span className="text-muted">{pct}% used</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-brand to-rose-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-faint">
          <span>
            {Math.max(
              0,
              limit - used - (bucket?.reserved_tokens ?? 0),
            ).toLocaleString()}{" "}
            available
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3" />
            Resets 00:00 UTC
          </span>
        </div>
      </div>
      <div className="mt-7 overflow-hidden rounded-3xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="font-semibold">Recent AI activity</h2>
          <span className="inline-flex items-center gap-1 text-[11px] text-faint">
            <LockKeyhole className="size-3" />
            No prompt or output content
          </span>
        </div>
        {events.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">
            No metered activity yet.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {events.map((e) => (
              <div
                key={e.id}
                className="grid grid-cols-[1fr_auto] gap-3 p-4 text-sm"
              >
                <div>
                  <span className="font-medium capitalize">
                    {e.operation.replace(/-/g, " ")}
                  </span>
                  <span className="ml-2 text-xs text-faint">{e.model}</span>
                  <p className="mt-1 text-[11px] text-faint">
                    {new Date(e.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs">
                    {e.total_tokens.toLocaleString()} tok
                  </div>
                  <div className="mt-1 text-[10px] capitalize text-faint">
                    {e.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
function Stat({
  icon: Icon,
  label,
  value,
  suffix,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  suffix: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-5">
      <Icon className="size-4 text-brand" />
      <div className="mt-4 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted">
        {label}
        <span className="text-faint">{suffix}</span>
      </div>
    </div>
  );
}

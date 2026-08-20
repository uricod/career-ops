"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ExternalLink, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/community/supabase-browser";
import type { CommunityApplication } from "@/lib/community/types";

const DEMO_KEY = "career-ops:community-applications";
const statuses: CommunityApplication["status"][] = [
  "saved",
  "ready",
  "applied",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
  "skipped",
];

function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function TrackerClient() {
  const [items, setItems] = useState<CommunityApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    title: "",
    company: "",
    job_url: "",
    location: "",
  });
  const supabase = getSupabaseBrowserClient();
  const load = useCallback(async () => {
    setLoading(true);
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("applications")
          .select("*")
          .order("updated_at", { ascending: false });
        setItems((data ?? []) as CommunityApplication[]);
        setLoading(false);
        return;
      }
    }
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) {
      try {
        setItems(JSON.parse(raw));
      } catch {
        localStorage.removeItem(DEMO_KEY);
        setItems([]);
      }
    } else setItems([]);
    setLoading(false);
  }, [supabase]);
  useEffect(() => {
    void load();
  }, [load]);
  const persistDemo = (next: CommunityApplication[]) => {
    setItems(next);
    localStorage.setItem(DEMO_KEY, JSON.stringify(next));
  };
  async function add(e: FormEvent) {
    e.preventDefault();
    setNotice("");
    const url = safeUrl(form.job_url);
    if (!url) {
      setNotice("Add a full http or https job URL.");
      return;
    }
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from("applications")
          .insert({
            user_id: user.id,
            ...form,
            job_url: url,
            source: "manual",
          });
        if (error) {
          setNotice(
            error.code === "23505"
              ? "That job is already in your tracker."
              : error.message,
          );
          return;
        }
        setForm({ title: "", company: "", job_url: "", location: "" });
        await load();
        return;
      }
    }
    const now = new Date().toISOString();
    persistDemo([
      {
        id: crypto.randomUUID(),
        user_id: "demo",
        ...form,
        job_url: url,
        source: "manual",
        status: "saved",
        score: null,
        note: "",
        saved_at: now,
        updated_at: now,
      },
      ...items,
    ]);
    setForm({ title: "", company: "", job_url: "", location: "" });
  }
  async function changeStatus(
    item: CommunityApplication,
    status: CommunityApplication["status"],
  ) {
    if (supabase && item.user_id !== "demo") {
      await supabase.from("applications").update({ status }).eq("id", item.id);
      await load();
      return;
    }
    persistDemo(
      items.map((x) =>
        x.id === item.id
          ? { ...x, status, updated_at: new Date().toISOString() }
          : x,
      ),
    );
  }
  async function remove(item: CommunityApplication) {
    if (supabase && item.user_id !== "demo") {
      await supabase.from("applications").delete().eq("id", item.id);
      await load();
      return;
    }
    persistDemo(items.filter((x) => x.id !== item.id));
  }
  return (
    <div className="mx-auto max-w-6xl px-5 py-10 pb-28 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-brand-text">
            Your private pipeline
          </p>
          <h1 className="mt-2 font-serif text-5xl text-landing">My jobs</h1>
          <p className="mt-3 text-sm text-muted">
            A small, intentional list beats fifty forgotten tabs.
          </p>
        </div>
        <div className="rounded-full bg-surface px-4 py-2 text-xs text-faint">
          {items.length} saved · content visible only to you
        </div>
      </div>
      <form
        onSubmit={add}
        className="mt-8 grid gap-3 rounded-3xl border border-border bg-surface p-4 shadow-sm md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.4fr_1fr_auto]"
      >
        {(["title", "company", "job_url", "location"] as const).map((key) => (
          <label
            key={key}
            className="text-[11px] font-semibold uppercase tracking-wider text-faint"
          >
            {key === "job_url" ? "Job URL" : key}
            <input
              required={key !== "location"}
              type={key === "job_url" ? "url" : "text"}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-brand"
              placeholder={
                key === "title"
                  ? "Operations Manager"
                  : key === "company"
                    ? "Organization"
                    : key === "job_url"
                      ? "https://…"
                      : "Remote / city"
              }
            />
          </label>
        ))}
        <button className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-brand-foreground hover:bg-brand-200">
          <Plus className="size-4" />
          Save
        </button>
      </form>
      {notice && (
        <p role="alert" className="mt-3 text-sm text-rose-600">
          {notice}
        </p>
      )}
      {loading ? (
        <div className="grid min-h-56 place-items-center">
          <LoaderCircle className="size-5 animate-spin text-brand" />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-border p-12 text-center">
          <p className="font-serif text-2xl text-landing">
            Your shortlist is beautifully empty.
          </p>
          <p className="mt-2 text-sm text-muted">
            Add a role above or discover one in Find jobs.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-3xl border border-border bg-surface">
          <div className="divide-y divide-border">
            {items.map((item) => (
              <div
                key={item.id}
                className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-semibold">
                      {item.title || "Untitled role"}
                    </h2>
                    <a
                      href={safeUrl(item.job_url) ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open original job"
                      className="text-faint hover:text-brand"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {item.company || "Unknown company"}
                    {item.location ? ` · ${item.location}` : ""}
                  </p>
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-faint">
                    Saved {new Date(item.saved_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    aria-label={`Status for ${item.title}`}
                    value={item.status}
                    onChange={(e) =>
                      void changeStatus(
                        item,
                        e.target.value as CommunityApplication["status"],
                      )
                    }
                    className="min-h-10 rounded-full border border-border bg-background px-3 text-xs capitalize outline-none focus:border-brand"
                  >
                    {statuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => void remove(item)}
                    aria-label={`Remove ${item.title}`}
                    className="grid min-h-10 min-w-10 place-items-center rounded-full text-faint hover:bg-rose-500/10 hover:text-rose-600"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

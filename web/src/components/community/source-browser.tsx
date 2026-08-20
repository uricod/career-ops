"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Globe2,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import {
  COMMUNITY_JOB_SOURCES,
  sourceSearchUrl,
  type CommunityJobSource,
} from "@/lib/community/sources";
import { cn } from "@/lib/cn";

const groups: { id: "all" | CommunityJobSource["kind"]; label: string }[] = [
  { id: "all", label: "All sources" },
  { id: "frum", label: "Frum" },
  { id: "orthodox", label: "Orthodox" },
  { id: "jewish", label: "Jewish communal" },
  { id: "israel", label: "Israel" },
];

export function SourceBrowser() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [group, setGroup] = useState<(typeof groups)[number]["id"]>("all");
  const filtered = useMemo(
    () =>
      COMMUNITY_JOB_SOURCES.filter((s) => group === "all" || s.kind === group),
    [group],
  );
  const intent = [query.trim(), location.trim()].filter(Boolean).join(" ");
  const allAtsUrl = `https://www.google.com/search?q=${encodeURIComponent(`${intent} (site:boards.greenhouse.io OR site:jobs.lever.co OR site:jobs.ashbyhq.com OR site:myworkdayjobs.com)`)}&tbs=qdr:m`;

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 pb-28 lg:px-8 lg:pb-14">
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand-text">
          <ShieldCheck className="size-3.5" />
          Verified source directory
        </div>
        <h1 className="mt-4 font-serif text-5xl tracking-tight text-landing">
          Find the places your next role might be hiding.
        </h1>
        <p className="mt-4 text-base leading-7 text-muted">
          Search community-focused boards and public ATS listings without
          spending AI tokens. Results open on the original source.
        </p>
      </div>

      <div className="mt-9 rounded-3xl border border-border bg-surface p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <label className="flex min-h-14 items-center gap-3 rounded-2xl bg-background px-4 focus-within:ring-2 focus-within:ring-brand/40">
            <Search className="size-5 text-faint" />
            <span className="sr-only">Job title or skill</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
              placeholder="Job title or skill"
            />
          </label>
          <label className="flex min-h-14 items-center gap-3 rounded-2xl bg-background px-4 focus-within:ring-2 focus-within:ring-brand/40">
            <MapPin className="size-5 text-faint" />
            <span className="sr-only">Location</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
              placeholder="Remote, Brooklyn, Lakewood…"
            />
          </label>
          <a
            href={allAtsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-brand px-6 text-sm font-bold text-brand-foreground transition hover:bg-brand-200"
          >
            Search public ATS <ArrowUpRight className="size-4" />
          </a>
        </div>
        <p className="mt-3 px-2 text-[11px] text-faint">
          The ATS search opens a time-filtered search across Greenhouse, Lever,
          Ashby, and Workday. No account or token charge.
        </p>
      </div>

      <div className="mt-8 flex items-center gap-2 overflow-x-auto pb-2">
        <SlidersHorizontal className="mr-1 size-4 shrink-0 text-faint" />
        {groups.map((g) => (
          <button
            key={g.id}
            onClick={() => setGroup(g.id)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition",
              group === g.id
                ? "border-brand/35 bg-brand-soft text-brand-text"
                : "border-border bg-surface text-muted hover:text-foreground",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((source) => (
          <article
            key={source.id}
            className="group flex min-h-72 flex-col rounded-3xl border border-border bg-surface p-6 transition hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-sm font-black text-brand-text">
                {source.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")}
              </div>
              <span className="rounded-full border border-border px-2.5 py-1 text-[10px] uppercase tracking-wider text-faint">
                {source.coverage}
              </span>
            </div>
            <h2 className="mt-5 text-lg font-semibold tracking-tight">
              {source.name}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-muted">
              {source.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {source.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-background px-2 py-1 text-[10px] text-faint"
                >
                  {t}
                </span>
              ))}
            </div>
            <a
              href={sourceSearchUrl(source, intent)}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold transition hover:border-brand/40 hover:text-brand-text"
            >
              {intent ? "Search this source" : "Browse jobs"}
              <ArrowUpRight className="size-4" />
            </a>
          </article>
        ))}
      </div>
      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-border bg-surface/50 p-4 text-xs leading-5 text-muted">
        <Globe2 className="mt-0.5 size-4 shrink-0 text-brand" />
        <p>
          Source names and descriptions are for navigation and attribution.
          Career Ops does not copy listings, endorse every employer, or
          guarantee that a posting is active. Verify the role on its original
          page before applying.
        </p>
      </div>
    </div>
  );
}

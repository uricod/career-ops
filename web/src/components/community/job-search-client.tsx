"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  BrainCircuit,
  Check,
  CheckCircle2,
  Circle,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Plus,
  Radar,
  Search,
  Sparkles,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/community/supabase-browser";
import {
  HOSTED_SEARCH_SOURCES,
  type HostedSearchEvent,
  type HostedSearchResult,
  type RankedSearchResult,
} from "@/lib/community/job-search";
import { cn } from "@/lib/cn";

type SourceRun = {
  state: "waiting" | "running" | "done";
  checked: number;
  total: number;
  matches: number;
  failed: number;
};

const freshRuns = () =>
  Object.fromEntries(
    HOSTED_SEARCH_SOURCES.map((source) => [
      source.id,
      { state: "waiting", checked: 0, total: 0, matches: 0, failed: 0 },
    ]),
  ) as Record<string, SourceRun>;

export function JobSearchClient() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [sinceDays, setSinceDays] = useState(30);
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState(freshRuns);
  const [results, setResults] = useState<HostedSearchResult[]>([]);
  const [summary, setSummary] = useState<{ boardsChecked: number; failedBoards: number } | null>(null);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [aiProvider, setAiProvider] = useState("AI");
  const [searchedLocation, setSearchedLocation] = useState("");
  const [indexedJobs, setIndexedJobs] = useState(0);
  const [resume, setResume] = useState("");
  const [showAi, setShowAi] = useState(false);
  const [ranking, setRanking] = useState<Record<string, RankedSearchResult>>({});
  const [rankingMode, setRankingMode] = useState("");
  const [rankingUsage, setRankingUsage] = useState(0);
  const [rankingBusy, setRankingBusy] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [notices, setNotices] = useState<Record<string, string>>({});
  const abortRef = useRef<AbortController | null>(null);

  const sortedResults = useMemo(() => {
    if (!Object.keys(ranking).length) return results;
    return [...results].sort(
      (a, b) => (ranking[b.id]?.score ?? -1) - (ranking[a.id]?.score ?? -1),
    );
  }, [ranking, results]);

  function handleEvent(event: HostedSearchEvent) {
    if (event.kind === "start") {
      setAiConfigured(event.aiConfigured);
      setAiProvider(event.aiProvider || "AI");
      setSearchedLocation(event.searchedLocation || "");
      setIndexedJobs(Number(event.indexedJobs || 0));
    }
    else if (event.kind === "sourceStart")
      setRuns((current) => ({
        ...current,
        [event.source]: { ...current[event.source], state: "running", total: event.boards },
      }));
    else if (event.kind === "sourceProgress")
      setRuns((current) => ({
        ...current,
        [event.source]: {
          ...current[event.source],
          state: "running",
          checked: event.checked,
          total: event.total,
          matches: event.matches,
        },
      }));
    else if (event.kind === "sourceDone")
      setRuns((current) => ({
        ...current,
        [event.source]: {
          state: "done",
          checked: event.checked,
          total: event.checked,
          matches: event.matches,
          failed: event.failed,
        },
      }));
    else if (event.kind === "result")
      setResults((current) =>
        current.some((item) => item.url === event.result.url)
          ? current
          : [...current, event.result],
      );
    else if (event.kind === "warning")
      setWarnings((current) => [...current, event.message]);
    else if (event.kind === "done")
      setSummary({ boardsChecked: event.boardsChecked, failedBoards: event.failedBoards });
  }

  async function runSearch(event: FormEvent) {
    event.preventDefault();
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setRunning(true);
    setError("");
    setWarnings([]);
    setResults([]);
    setSummary(null);
    setRuns(freshRuns());
    setSearchedLocation("");
    setIndexedJobs(0);
    setRanking({});
    setRankingMode("");
    try {
      const response = await fetch("/api/community/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, location, sinceDays }),
        signal: abort.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Search could not start.");
      }
      if (!response.body) throw new Error("Search stream was unavailable.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            handleEvent(JSON.parse(line) as HostedSearchEvent);
          } catch {
            // One malformed provider line must not stop the run.
          }
        }
        if (done) break;
      }
    } catch (caught) {
      if ((caught as Error).name !== "AbortError")
        setError(caught instanceof Error ? caught.message : "Search failed.");
    } finally {
      setRunning(false);
    }
  }

  async function rankResults() {
    setRankingBusy(true);
    setError("");
    sessionStorage.setItem("career-ops:resume-session", resume);
    try {
      const response = await fetch("/api/community/rank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_text: resume, candidates: results.slice(0, 24) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Shortlist failed.");
      setRanking(
        Object.fromEntries(
          (body.ranking as RankedSearchResult[]).map((item) => [item.id, item]),
        ),
      );
      setRankingMode(body.mode);
      setRankingUsage(Number(body.usage?.total_tokens || 0));
      setShowAi(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Shortlist failed.");
    } finally {
      setRankingBusy(false);
    }
  }

  async function saveResult(result: HostedSearchResult) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setNotices((current) => ({ ...current, [result.id]: "Tracker is unavailable." }));
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const rank = ranking[result.id];
    const { error: insertError } = await supabase.from("applications").insert({
      user_id: user.id,
      job_url: result.url,
      company: result.company,
      title: result.title,
      location: result.location,
      source: result.source,
      score: rank?.score ?? null,
      note: rank?.reason ?? "",
      status: rank?.score && rank.score >= 4 ? "ready" : "saved",
    });
    if (insertError && insertError.code !== "23505") {
      setNotices((current) => ({ ...current, [result.id]: insertError.message }));
      return;
    }
    setSaved((current) => new Set(current).add(result.id));
  }

  function openFitCheck(result: HostedSearchResult) {
    sessionStorage.removeItem("career-ops:job-session");
    sessionStorage.setItem("career-ops:job-source-url-session", result.url);
    if (result.description.length >= 80) {
      sessionStorage.setItem("career-ops:job-session", result.description);
      sessionStorage.removeItem("career-ops:job-source-url-session");
    }
    window.location.href = "/community/fit";
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 pb-28 lg:px-8 lg:pb-16">
      <div className="grid gap-8 lg:grid-cols-[1fr_.7fr] lg:items-end">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand-text">
            <Radar className="size-3.5" /> One private search run
          </div>
          <h1 className="mt-4 font-serif text-5xl tracking-tight text-landing sm:text-6xl">
            Search every board in one place.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
            Career Ops searches a daily index of public company boards and checks
            community boards live, then puts every match into one list.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 text-sm leading-6 text-muted">
          <strong className="text-foreground">How it works:</strong> the scanner
          collects live listings first. Only when you ask does AI compare a
          shortlist with your resume under your daily allowance.
        </div>
      </div>

      <form onSubmit={runSearch} className="mt-8 rounded-3xl border border-border bg-surface p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[1.1fr_.8fr_auto_auto]">
          <label className="flex min-h-14 items-center gap-3 rounded-2xl bg-background px-4 focus-within:ring-2 focus-within:ring-brand/40">
            <Search className="size-5 text-faint" />
            <span className="sr-only">Role, title, or skill</span>
            <input required minLength={2} maxLength={120} value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-faint" placeholder="Operations manager, bookkeeping, software…" />
          </label>
          <label className="flex min-h-14 items-center gap-3 rounded-2xl bg-background px-4 focus-within:ring-2 focus-within:ring-brand/40">
            <MapPin className="size-5 text-faint" />
            <span className="sr-only">Location</span>
            <input maxLength={120} value={location} onChange={(event) => setLocation(event.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-faint" placeholder="Remote, Brooklyn, Lakewood, NJ…" />
          </label>
          <label className="grid min-h-14 content-center rounded-2xl bg-background px-4 text-[10px] font-bold uppercase tracking-wider text-faint">
            Posted within
            <select value={sinceDays} onChange={(event) => setSinceDays(Number(event.target.value))} className="mt-0.5 bg-transparent text-sm font-medium normal-case tracking-normal text-foreground outline-none">
              {[7, 14, 30, 60].map((days) => <option key={days} value={days}>{days} days</option>)}
            </select>
          </label>
          <button disabled={running} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-brand px-6 text-sm font-bold text-brand-foreground transition hover:bg-brand-200 disabled:opacity-60">
            {running ? <LoaderCircle className="size-4 animate-spin" /> : <Radar className="size-4" />}
            {running ? "Checking boards…" : "Run job search"}
          </button>
        </div>
        <p className="mt-3 px-2 text-[11px] text-faint">
          1.4M+ current listings from 20,000+ public ATS company boards + All
          Frum Jobs, YidJob, TrefAJob, and Luach. Index search is free; Grok
          runs only when you choose AI shortlist or Full fit check.
        </p>
      </form>

      {(running || summary) && (
        <section className="mt-6 rounded-3xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">{running ? "Search running live" : "Search complete"}</h2>
              <p className="mt-1 text-xs text-faint">
                {results.length} unified matches · index-only search (no AI charge)
                {searchedLocation && searchedLocation.toLowerCase() !== location.trim().toLowerCase()
                  ? ` · resolved to ${searchedLocation}`
                  : ""}
              </p>
            </div>
            {running && <button type="button" onClick={() => abortRef.current?.abort()} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted">Stop run</button>}
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {HOSTED_SEARCH_SOURCES.map((source) => {
              const run = runs[source.id];
              return (
                <div key={source.id} className={cn("rounded-2xl border p-3 transition", run.state === "running" ? "border-brand/40 bg-brand-soft/40" : "border-border bg-background")}>
                  <div className="flex items-center gap-2">
                    {run.state === "running" ? <LoaderCircle className="size-4 animate-spin text-brand" /> : run.state === "done" ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Circle className="size-4 text-faint" />}
                    <span className="text-sm font-semibold">{source.label}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-faint">
                    {run.state === "waiting" ? source.detail : `${run.checked}/${run.total || run.checked} ${source.id === "atsindex" ? "index segments" : "checked"} · ${run.matches} matches${run.failed ? ` · ${run.failed} unavailable` : ""}`}
                  </p>
                </div>
              );
            })}
          </div>
          {summary && (
            <p className="mt-4 text-xs text-muted">
              {indexedJobs > 0 ? `Searched ${indexedJobs.toLocaleString()} indexed listings plus your enabled community boards. ` : ""}
              {summary.failedBoards > 0 ? `${summary.failedBoards} data segments or boards did not answer; the run continued.` : "Every data source answered."}
              {" "}<a className="underline" href="https://github.com/Feashliaa/job-board-aggregator" target="_blank" rel="noreferrer">ATS index attribution</a>.
            </p>
          )}
        </section>
      )}

      {(error || warnings.length > 0) && (
        <div className="mt-5 flex gap-2 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-800">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <div>{error && <p>{error}</p>}{warnings.slice(-2).map((warning) => <p key={warning}>{warning}</p>)}</div>
        </div>
      )}

      {results.length > 0 && (
        <section className="mt-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-text">Unified results</p>
              <h2 className="mt-2 font-serif text-4xl text-landing">{rankingMode ? "Your ranked shortlist" : `${results.length} roles found`}</h2>
              {rankingMode && <p className="mt-2 text-xs text-faint">{rankingMode === "ai" ? `${aiProvider} ranked · ${rankingUsage.toLocaleString()} tokens used` : "Private keyword rank · AI key not connected · 0 tokens"}</p>}
            </div>
            <button type="button" onClick={() => { setResume(sessionStorage.getItem("career-ops:resume-session") || ""); setShowAi((current) => !current); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background">
              <BrainCircuit className="size-4" /> {rankingMode ? `Run ${aiProvider} again` : `Use ${aiProvider} to shortlist`}
            </button>
          </div>

          {showAi && (
            <div className="mt-5 grid gap-5 rounded-3xl border border-brand/30 bg-brand-soft/30 p-5 lg:grid-cols-[1fr_auto] lg:items-end">
              <label className="text-sm font-semibold">
                Resume evidence <span className="ml-2 text-xs font-normal text-faint">kept in this browser tab; never stored</span>
                <textarea minLength={80} maxLength={12000} value={resume} onChange={(event) => setResume(event.target.value)} className="mt-2 min-h-36 w-full resize-y rounded-2xl border border-border bg-surface p-4 text-sm leading-6 outline-none focus:border-brand" placeholder="Paste your resume text once. AI will compare it with up to 24 found roles." />
              </label>
              <div>
                <button type="button" disabled={rankingBusy || resume.trim().length < 80} onClick={() => void rankResults()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-brand-foreground disabled:opacity-50">
                  {rankingBusy ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {rankingBusy ? "AI is comparing…" : "Rank best matches"}
                </button>
                <p className="mt-2 max-w-56 text-[10px] leading-4 text-faint">{aiConfigured === false ? "The AI provider is not connected yet, so this demonstrates the flow with a private 0-token rank." : "This is the metered step. Exact tokens appear in Allowance."}</p>
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {sortedResults.map((result) => {
              const rank = ranking[result.id];
              return (
                <article key={result.id} className="rounded-3xl border border-border bg-surface p-5 transition hover:border-brand/35">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-semibold text-faint">{result.sourceLabel}</span>
                        {result.postedAt && <span className="text-[10px] text-faint">{new Date(result.postedAt).toLocaleDateString()}</span>}
                      </div>
                      <h3 className="mt-3 text-lg font-semibold leading-6">{result.title}</h3>
                      <p className="mt-1 text-sm text-muted">{result.company}{result.location ? ` · ${result.location}` : ""}</p>
                    </div>
                    {rank && <div className="shrink-0 rounded-2xl bg-brand-soft px-3 py-2 text-center text-brand-text"><div className="font-serif text-2xl leading-none">{rank.score.toFixed(1)}</div><div className="mt-1 text-[9px] uppercase tracking-wider">match</div></div>}
                  </div>
                  {rank && <p className="mt-4 rounded-2xl bg-background p-3 text-xs leading-5 text-muted">{rank.reason}</p>}
                  {result.matchedTerms.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{result.matchedTerms.slice(0, 5).map((term) => <span key={term} className="rounded-full bg-brand-soft px-2 py-1 text-[10px] text-brand-text">{term}</span>)}</div>}
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void saveResult(result)} disabled={saved.has(result.id)} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-foreground px-4 text-xs font-semibold text-background disabled:opacity-60">
                      {saved.has(result.id) ? <Check className="size-3.5" /> : <Plus className="size-3.5" />} {saved.has(result.id) ? "Saved" : "Save to board"}
                    </button>
                    <button type="button" onClick={() => openFitCheck(result)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-4 text-xs font-semibold">Full fit check <ArrowUpRight className="size-3.5" /></button>
                    <a href={result.url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-xs font-semibold text-muted">Original <ExternalLink className="size-3.5" /></a>
                  </div>
                  {notices[result.id] && <p className="mt-3 text-xs text-rose-600">{notices[result.id]}</p>}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {!running && summary && results.length === 0 && (
        <div className="mt-8 rounded-3xl border border-dashed border-border p-12 text-center">
          <p className="font-serif text-2xl text-landing">No honest matches this run.</p>
          <p className="mt-2 text-sm text-muted">Try a broader title, include the state with a city, or remove the location. City-only searches use your current region when available because many ATS feeds publish only a state.</p>
        </div>
      )}
    </div>
  );
}

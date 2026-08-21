"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  LockKeyhole,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { FitEvaluation } from "@/lib/community/types";

export function FitCheckClient() {
  const [job, setJob] = useState("");
  const [resume, setResume] = useState("");
  const [result, setResult] = useState<FitEvaluation | null>(null);
  const [usage, setUsage] = useState<{
    total_tokens: number;
    estimated_microusd?: number;
  } | null>(null);
  const [mode, setMode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setJob(sessionStorage.getItem("career-ops:job-session") || "");
    setResume(sessionStorage.getItem("career-ops:resume-session") || "");
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    sessionStorage.setItem("career-ops:resume-session", resume);
    try {
      const response = await fetch("/api/community/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_description: job, resume_text: resume }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Fit check failed.");
      setResult(data.evaluation);
      setUsage(data.usage);
      setMode(data.mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fit check failed.");
    } finally {
      setBusy(false);
    }
  }
  const verdictTone =
    result?.verdict === "strong"
      ? "text-emerald-600 bg-emerald-500/10"
      : result?.verdict === "possible"
        ? "text-sky-600 bg-sky-500/10"
        : result?.verdict === "stretch"
          ? "text-amber-600 bg-amber-500/10"
          : "text-rose-600 bg-rose-500/10";
  return (
    <div className="mx-auto max-w-6xl px-5 py-10 pb-28 lg:px-8">
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand-text">
          <BrainCircuit className="size-3.5" />
          Evidence-first AI
        </div>
        <h1 className="mt-4 font-serif text-5xl text-landing">
          Is this role worth your time?
        </h1>
        <p className="mt-4 text-base leading-7 text-muted">
          Paste the posting and your resume. We compare only what you provide—no
          invented skills, no stored document text.
        </p>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_.85fr]">
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-semibold">
            Job description{" "}
            <span className="font-normal text-faint">(untrusted data)</span>
            <textarea
              required
              minLength={80}
              maxLength={18000}
              value={job}
              onChange={(e) => setJob(e.target.value)}
              className="mt-2 min-h-64 w-full resize-y rounded-2xl border border-border bg-surface p-4 text-sm leading-6 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              placeholder="Paste the full posting…"
            />
          </label>
          <label className="block text-sm font-semibold">
            Your resume evidence{" "}
            <span className="font-normal text-faint">
              (kept in this browser tab)
            </span>
            <textarea
              required
              minLength={80}
              maxLength={18000}
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              className="mt-2 min-h-64 w-full resize-y rounded-2xl border border-border bg-surface p-4 text-sm leading-6 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              placeholder="Paste your resume text…"
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              disabled={busy}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-brand-foreground disabled:opacity-60"
            >
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {busy ? "Checking evidence…" : "Run fit check"}
            </button>
            <span className="inline-flex items-center gap-1.5 text-xs text-faint">
              <LockKeyhole className="size-3.5" />
              No document persistence
            </span>
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-700"
            >
              {error}
            </p>
          )}
        </form>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          {!result ? (
            <div className="rounded-3xl border border-dashed border-border bg-surface/45 p-8">
              <div className="grid size-12 place-items-center rounded-2xl bg-brand-soft">
                <TriangleAlert className="size-5 text-brand" />
              </div>
              <h2 className="mt-5 font-serif text-2xl text-landing">
                An honest answer, not a pep talk.
              </h2>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-muted">
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-500" />
                  Strengths tied to resume evidence
                </li>
                <li className="flex gap-2">
                  <CircleAlert className="mt-1 size-4 shrink-0 text-amber-500" />
                  Gaps you should verify, never disguise
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-500" />
                  A clear apply-or-skip next step
                </li>
              </ul>
            </div>
          ) : (
            <div className="rounded-3xl border border-border bg-surface p-6 shadow-xl">
              <div className="flex items-center justify-between gap-4">
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${verdictTone}`}
                >
                  {result.verdict}
                </span>
                <span className="font-serif text-4xl text-landing">
                  {result.score.toFixed(1)}
                  <span className="text-lg text-faint">/5</span>
                </span>
              </div>
              <h2 className="mt-5 text-lg font-semibold">{result.headline}</h2>
              <section className="mt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                  Supported strengths
                </h3>
                <ul className="mt-2 space-y-2 text-sm text-muted">
                  {result.strengths.map((x) => (
                    <li key={x} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                      {x}
                    </li>
                  ))}
                </ul>
              </section>
              <section className="mt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600">
                  Verify these gaps
                </h3>
                <ul className="mt-2 space-y-2 text-sm text-muted">
                  {result.gaps.map((x) => (
                    <li key={x} className="flex gap-2">
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
                      {x}
                    </li>
                  ))}
                </ul>
              </section>
              <div className="mt-6 rounded-2xl bg-background p-4 text-sm leading-6">
                <strong>Next:</strong> {result.next_step}
              </div>
              <p className="mt-4 text-xs leading-5 text-faint">
                {result.caveat}
              </p>
              <div className="mt-5 border-t border-border pt-4 text-[11px] text-faint">
                {mode === "private-fallback"
                  ? "Private keyword check · 0 AI tokens"
                  : `${usage?.total_tokens.toLocaleString() || 0} tokens · approx. $${((usage?.estimated_microusd || 0) / 1_000_000).toFixed(4)}`}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

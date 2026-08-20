"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { CoMark } from "@/components/co-mark";
import { getSupabaseBrowserClient } from "@/lib/community/supabase-browser";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage(
        "Cloud sign-in is not configured in this preview. You can still browse jobs and try the private zero-token fit check.",
      );
      setBusy(false);
      return;
    }
    const redirectTo = `${window.location.origin}/auth/callback?next=/community`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) setError(error.message);
    else setMessage("Check your inbox for a secure sign-in link.");
    setBusy(false);
  }
  return (
    <div className="relative grid min-h-screen place-items-center px-5 py-12">
      <div className="absolute inset-0 dot-bg opacity-70" />
      <div className="absolute left-1/2 top-[-18rem] size-[38rem] -translate-x-1/2 rounded-full bg-brand/15 blur-3xl" />
      <div className="relative w-full max-w-md rounded-[2rem] border border-border bg-surface/95 p-7 shadow-2xl backdrop-blur sm:p-9">
        <Link
          href="/community"
          className="inline-flex items-center gap-1.5 text-xs text-faint hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back home
        </Link>
        <div className="mt-7 flex items-center gap-3">
          <CoMark size={38} />
          <div>
            <div className="font-serif text-2xl text-landing">career-ops</div>
            <div className="text-[10px] font-bold uppercase tracking-[.2em] text-brand-text">
              community
            </div>
          </div>
        </div>
        <h1 className="mt-8 font-serif text-4xl text-landing">Welcome in.</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          No password to remember. We’ll email you a one-time secure link.
        </p>
        {message ? (
          <div className="mt-7 rounded-2xl bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-700">
            <CheckCircle2 className="mb-2 size-5" />
            {message}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-7">
            <label className="text-sm font-semibold">
              Email address
              <div className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-background px-4 focus-within:border-brand">
                <Mail className="size-4 text-faint" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-sm outline-none"
                  placeholder="you@example.org"
                />
              </div>
            </label>
            <button
              disabled={busy}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand font-bold text-brand-foreground hover:bg-brand-200 disabled:opacity-60"
            >
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>
            {error && (
              <p role="alert" className="mt-3 text-sm text-rose-600">
                {error}
              </p>
            )}
          </form>
        )}
        <div className="mt-7 flex gap-2 border-t border-border pt-5 text-xs leading-5 text-faint">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
          Your email is used for account access and service notices—not sold or
          used for recruiter marketing.
        </div>
      </div>
    </div>
  );
}

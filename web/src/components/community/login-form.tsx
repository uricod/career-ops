"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  Mail,
} from "lucide-react";
import { COMMUNITY_NAME } from "@/lib/community/config";

export function LoginForm({
  initialInvite = "",
  initialEmail = "",
  initialError = "",
}: {
  initialInvite?: string;
  initialEmail?: string;
  initialError?: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [invite, setInvite] = useState(initialInvite);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(
    initialError === "invite"
      ? "That invitation is missing, expired, or no longer active."
      : initialError === "auth"
        ? "The sign-in link could not be verified. Please request a new one."
        : "",
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/community/auth/request-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, invite }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Invitation unavailable.");
      setMessage("Check your inbox. The private sign-in link expires shortly.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Invitation unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#f4f2ed] text-[#181815] dark:bg-[#10100f] dark:text-[#f2f0e9] lg:grid-cols-[.85fr_1.15fr]">
      <section className="flex flex-col border-b border-black/10 p-6 dark:border-white/10 lg:border-b-0 lg:border-r lg:p-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-black/45 hover:text-black dark:text-white/45 dark:hover:text-white"
        >
          <ArrowLeft className="size-3.5" /> Back
        </Link>
        <div className="mt-auto hidden pb-4 lg:block">
          <p className="text-sm font-semibold">{COMMUNITY_NAME}</p>
          <p className="mt-2 max-w-xs text-xs leading-5 text-black/45 dark:text-white/45">
            Access is issued individually and can be withdrawn by a community
            administrator.
          </p>
        </div>
      </section>

      <section className="flex items-center px-6 py-14 sm:px-12 lg:px-20">
        <div className="w-full max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-black/40 dark:text-white/40">
            Member access
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-none tracking-tight">
            Sign in to The Commons.
          </h1>
          <p className="mt-4 text-sm leading-6 text-black/55 dark:text-white/55">
            Returning members only need their email. First-time members also
            enter the private code from their invitation.
          </p>

          {message ? (
            <div className="mt-8 rounded-2xl border border-emerald-600/20 bg-emerald-600/10 p-5 text-sm leading-6 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="mb-3 size-5" />
              {message}
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-4">
              <Field icon={Mail} label="Invited email">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none"
                  placeholder="you@example.org"
                />
              </Field>
              <Field icon={KeyRound} label="Invitation code (first sign-in only)">
                <input
                  minLength={24}
                  maxLength={200}
                  autoComplete="one-time-code"
                  value={invite}
                  onChange={(event) => setInvite(event.target.value.trim())}
                  className="w-full bg-transparent font-mono text-sm outline-none"
                  placeholder="Returning member? Leave blank"
                />
              </Field>
              <button
                disabled={busy}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#181815] px-5 text-sm font-semibold text-white transition hover:opacity-85 disabled:opacity-50 dark:bg-[#f2f0e9] dark:text-[#181815]"
              >
                {busy ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Mail className="size-4" />
                )}
                {busy ? "Checking…" : "Send private sign-in link"}
              </button>
              {error && (
                <p
                  role="alert"
                  className="text-sm text-rose-700 dark:text-rose-400"
                >
                  {error}
                </p>
              )}
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-semibold">
      {label}
      <span className="mt-2 flex min-h-12 items-center gap-3 rounded-xl border border-black/15 bg-white/45 px-4 focus-within:border-black/45 dark:border-white/15 dark:bg-white/[.04] dark:focus-within:border-white/45">
        <Icon className="size-4 shrink-0 text-black/35 dark:text-white/35" />
        {children}
      </span>
    </label>
  );
}

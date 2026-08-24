"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { COMMUNITY_NAME } from "@/lib/community/config";
import { getSupabaseBrowserClient } from "@/lib/community/supabase-browser";

type LoginMode = "password" | "activate" | "link" | "reset";

export function LoginForm({
  initialInvite = "",
  initialEmail = "",
  initialError = "",
}: {
  initialInvite?: string;
  initialEmail?: string;
  initialError?: string;
}) {
  const [mode, setMode] = useState<LoginMode>(
    initialInvite ? "activate" : "password",
  );
  const [email, setEmail] = useState(initialEmail);
  const [invite, setInvite] = useState(initialInvite);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(
    initialError === "invite"
      ? "That invitation is missing, expired, or no longer active."
      : initialError === "auth"
        ? "The sign-in link could not be verified. Please request a new one."
        : "",
  );

  function switchMode(next: LoginMode) {
    setMode(next);
    setError("");
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "link" || mode === "reset") {
        const response = await fetch(
          mode === "reset"
            ? "/api/community/auth/reset-password"
            : "/api/community/auth/request-link",
          {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, invite }),
          },
        );
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            body.error ||
              (mode === "reset"
                ? "Password recovery is unavailable."
                : "Private link unavailable."),
          );
        setMessage(
          mode === "reset"
            ? "If that member account exists, a password-reset link is on its way."
            : "Check your inbox. The private link expires shortly.",
        );
        return;
      }

      if (password.length < 12 || password.length > 72)
        throw new Error("Use a password between 12 and 72 characters.");
      if (mode === "activate" && password !== confirmPassword)
        throw new Error("The passwords do not match.");
      if (mode === "activate") {
        const response = await fetch("/api/community/auth/activate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, invite, password }),
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || "That invitation is unavailable.");
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Sign-in is temporarily unavailable.");
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) throw new Error("Email or password is incorrect.");

      if (mode === "activate") {
        const { data, error: redeemError } = await supabase.rpc(
          "redeem_invitation",
          { p_code: invite },
        );
        if (redeemError || data !== true) {
          await supabase.auth.signOut();
          throw new Error("That invitation could not be activated.");
        }
        window.location.replace("/community/profile?welcome=1");
        return;
      }

      const { data: active, error: memberError } = await supabase.rpc(
        "is_active_member",
      );
      if (memberError || active !== true) {
        await supabase.auth.signOut();
        throw new Error("Active membership is required.");
      }
      window.location.replace("/community");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Sign-in is unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "password"
      ? "Welcome back."
      : mode === "activate"
        ? "Create your member login."
        : mode === "link"
          ? "Get a private sign-in link."
          : "Reset your password.";
  const description =
    mode === "password"
      ? "Sign in with the email and password attached to your membership."
      : mode === "activate"
        ? "Your invitation is your one-time access key. Choose the password you’ll use from now on."
        : mode === "link"
          ? "We’ll email a short-lived, one-time link to an active or invited member."
          : "We’ll email a short-lived recovery link to your member address.";

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
            {title}
          </h1>
          <p className="mt-4 text-sm leading-6 text-black/55 dark:text-white/55">
            {description}
          </p>

          {message ? (
            <div className="mt-8 rounded-2xl border border-emerald-600/20 bg-emerald-600/10 p-5 text-sm leading-6 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="mb-3 size-5" />
              {message}
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-4">
              <Field icon={Mail} label="Member email">
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

              {mode === "activate" && (
                <Field icon={KeyRound} label="Invitation code">
                  <input
                    required
                    minLength={24}
                    maxLength={200}
                    autoComplete="one-time-code"
                    value={invite}
                    onChange={(event) => setInvite(event.target.value.trim())}
                    className="w-full bg-transparent font-mono text-sm outline-none"
                    placeholder="Paste private code"
                  />
                </Field>
              )}

              {mode !== "link" && mode !== "reset" && (
                <Field
                  icon={LockKeyhole}
                  label={mode === "activate" ? "Create password" : "Password"}
                >
                  <input
                    type="password"
                    required
                    minLength={12}
                    maxLength={72}
                    autoComplete={
                      mode === "activate" ? "new-password" : "current-password"
                    }
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full bg-transparent text-sm outline-none"
                    placeholder="At least 12 characters"
                  />
                </Field>
              )}

              {mode === "activate" && (
                <Field icon={LockKeyhole} label="Confirm password">
                  <input
                    type="password"
                    required
                    minLength={12}
                    maxLength={72}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full bg-transparent text-sm outline-none"
                    placeholder="Repeat password"
                  />
                </Field>
              )}

              <button
                disabled={busy}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#181815] px-5 text-sm font-semibold text-white transition hover:opacity-85 disabled:opacity-50 dark:bg-[#f2f0e9] dark:text-[#181815]"
              >
                {busy ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : mode === "link" || mode === "reset" ? (
                  <Mail className="size-4" />
                ) : (
                  <LockKeyhole className="size-4" />
                )}
                {busy
                  ? "Checking…"
                  : mode === "password"
                    ? "Sign in"
                    : mode === "activate"
                      ? "Activate membership"
                      : mode === "reset"
                        ? "Send reset link"
                        : "Send private link"}
              </button>
              {error && (
                <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
                  {error}
                </p>
              )}
            </form>
          )}

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold">
            {mode !== "password" && (
              <button onClick={() => switchMode("password")}>Use password</button>
            )}
            {mode !== "activate" && (
              <button onClick={() => switchMode("activate")}>
                Use an invitation
              </button>
            )}
            {mode !== "link" && (
              <button onClick={() => switchMode("link")}>
                Email me a private link
              </button>
            )}
            {mode !== "reset" && (
              <button onClick={() => switchMode("reset")}>Forgot password?</button>
            )}
          </div>
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

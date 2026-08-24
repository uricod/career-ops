"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LoaderCircle, LockKeyhole } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/community/supabase-browser";

export function ResetPasswordForm() {
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    void (async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setError("Password recovery is temporarily unavailable.");
        setChecking(false);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.replace("/login?error=auth");
        return;
      }
      const { data: active, error: memberError } = await supabase.rpc(
        "is_active_member",
      );
      if (memberError || active !== true) {
        await supabase.auth.signOut();
        window.location.replace("/login?error=invite");
        return;
      }
      setChecking(false);
    })();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 12 || password.length > 72) {
      setError("Use a password between 12 and 72 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Password recovery is temporarily unavailable.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError("That recovery link expired. Request a new one and try again.");
      return;
    }
    setPassword("");
    setConfirmPassword("");
    setComplete(true);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f2ed] px-6 py-14 text-[#181815] dark:bg-[#10100f] dark:text-[#f2f0e9]">
      <section className="w-full max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-black/40 dark:text-white/40">
          Member access
        </p>
        <h1 className="mt-4 font-serif text-5xl leading-none tracking-tight">
          Choose a new password.
        </h1>
        <p className="mt-4 text-sm leading-6 text-black/55 dark:text-white/55">
          Use 12–72 characters. This replaces your current password.
        </p>

        {checking ? (
          <div className="mt-8 flex items-center gap-3 text-sm text-black/55 dark:text-white/55">
            <LoaderCircle className="size-4 animate-spin" /> Verifying your recovery link…
          </div>
        ) : complete ? (
          <div className="mt-8 rounded-2xl border border-emerald-600/20 bg-emerald-600/10 p-5 text-sm leading-6 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="mb-3 size-5" />
            Your password is updated.
            <Link
              href="/community"
              className="mt-4 block font-semibold underline underline-offset-4"
            >
              Open The Commons
            </Link>
          </div>
        ) : (
          <form onSubmit={save} className="mt-8 space-y-4">
            <PasswordField
              label="New password"
              value={password}
              onChange={setPassword}
            />
            <PasswordField
              label="Confirm new password"
              value={confirmPassword}
              onChange={setConfirmPassword}
            />
            <button
              disabled={busy}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#181815] px-5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-[#f2f0e9] dark:text-[#181815]"
            >
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <LockKeyhole className="size-4" />
              )}
              {busy ? "Saving…" : "Save new password"}
            </button>
            {error && (
              <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
                {error}
              </p>
            )}
          </form>
        )}
      </section>
    </main>
  );
}

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs font-semibold">
      {label}
      <span className="mt-2 flex min-h-12 items-center gap-3 rounded-xl border border-black/15 bg-white/45 px-4 dark:border-white/15 dark:bg-white/[.04]">
        <LockKeyhole className="size-4 text-black/35 dark:text-white/35" />
        <input
          type="password"
          required
          minLength={12}
          maxLength={72}
          autoComplete="new-password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent text-sm outline-none"
          placeholder="At least 12 characters"
        />
      </span>
    </label>
  );
}

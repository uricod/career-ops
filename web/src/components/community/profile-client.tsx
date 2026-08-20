"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, LoaderCircle, LogOut, Save, ShieldCheck } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/community/supabase-browser";
import type { CommunityProfile } from "@/lib/community/types";

const KEY = "career-ops:community-profile";
const empty: Omit<CommunityProfile, "id" | "daily_token_limit"> = {
  display_name: "",
  target_roles: [],
  locations: [],
  work_modes: ["remote", "hybrid"],
  salary_min: null,
  salary_max: null,
  include_community_sources: true,
};
function list(value: string) {
  return value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export function ProfileClient() {
  const supabase = getSupabaseBrowserClient();
  const [profile, setProfile] = useState({
    ...empty,
    id: "demo",
    daily_token_limit: 20000,
  } as CommunityProfile);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void (async () => {
      if (supabase) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();
          if (data) setProfile(data as CommunityProfile);
          else setProfile({ ...profile, id: user.id });
          setLoading(false);
          return;
        }
      }
      const raw = localStorage.getItem(KEY);
      if (raw) {
        try {
          setProfile(JSON.parse(raw));
        } catch {
          localStorage.removeItem(KEY);
        }
      }
      setLoading(false);
    })();
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    if (
      profile.salary_min &&
      profile.salary_max &&
      profile.salary_min > profile.salary_max
    ) {
      setError("Salary minimum cannot exceed the maximum.");
      return;
    }
    if (supabase && profile.id !== "demo") {
      const { id: _id, daily_token_limit: _limit, ...preferences } = profile;
      const { error } = await supabase
        .from("profiles")
        .update(preferences)
        .eq("id", profile.id);
      if (error) {
        setError(error.message);
        return;
      }
    } else localStorage.setItem(KEY, JSON.stringify(profile));
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }
  async function logout() {
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/community";
  }
  if (loading)
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <LoaderCircle className="size-5 animate-spin text-brand" />
      </div>
    );
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 pb-28 lg:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-brand-text">
            Search preferences
          </p>
          <h1 className="mt-2 font-serif text-5xl text-landing">Profile</h1>
        </div>
        <button
          onClick={() => void logout()}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-4 text-xs text-muted hover:text-foreground"
        >
          <LogOut className="size-3.5" />
          Sign out
        </button>
      </div>
      <div className="mt-7 flex gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[.06] p-4 text-xs leading-5 text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
        <p>
          These are search preferences, not identity fields. Community-source
          selection is optional. Resume text is not part of this profile.
        </p>
      </div>
      <form
        onSubmit={save}
        className="mt-6 space-y-5 rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8"
      >
        <Field
          label="Display name"
          value={profile.display_name}
          onChange={(v) =>
            setProfile({ ...profile, display_name: v.slice(0, 80) })
          }
          placeholder="How should we greet you?"
        />
        <Field
          label="Target roles"
          hint="Comma-separated"
          value={profile.target_roles.join(", ")}
          onChange={(v) => setProfile({ ...profile, target_roles: list(v) })}
          placeholder="Operations Manager, Data Analyst"
        />
        <Field
          label="Preferred locations"
          hint="Comma-separated"
          value={profile.locations.join(", ")}
          onChange={(v) => setProfile({ ...profile, locations: list(v) })}
          placeholder="Remote, Brooklyn, Lakewood"
        />
        <fieldset>
          <legend className="text-sm font-semibold">Work modes</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {["remote", "hybrid", "on-site"].map((mode) => {
              const active = profile.work_modes.includes(mode);
              return (
                <button
                  type="button"
                  key={mode}
                  onClick={() =>
                    setProfile({
                      ...profile,
                      work_modes: active
                        ? profile.work_modes.filter((x) => x !== mode)
                        : [...profile.work_modes, mode],
                    })
                  }
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-xs font-semibold capitalize ${active ? "border-brand/35 bg-brand-soft text-brand-text" : "border-border text-muted"}`}
                >
                  {active && <Check className="size-3.5" />}
                  {mode}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Salary minimum"
            value={profile.salary_min}
            onChange={(v) => setProfile({ ...profile, salary_min: v })}
          />
          <NumberField
            label="Salary maximum"
            value={profile.salary_max}
            onChange={(v) => setProfile({ ...profile, salary_max: v })}
          />
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-background p-4">
          <input
            type="checkbox"
            checked={profile.include_community_sources}
            onChange={(e) =>
              setProfile({
                ...profile,
                include_community_sources: e.target.checked,
              })
            }
            className="mt-1 size-4 accent-[var(--color-brand)]"
          />
          <span>
            <span className="text-sm font-semibold">
              Include Orthodox/Frum and Jewish community sources
            </span>
            <span className="mt-1 block text-xs leading-5 text-muted">
              This changes source discovery only. It does not label you,
              employers, or applications by religion.
            </span>
          </span>
        </label>
        {error && (
          <p role="alert" className="text-sm text-rose-600">
            {error}
          </p>
        )}
        <button className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-brand-foreground">
          {saved ? <Check className="size-4" /> : <Save className="size-4" />}
          {saved ? "Saved" : "Save preferences"}
        </button>
      </form>
    </div>
  );
}
function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      {hint && <span className="ml-2 font-normal text-faint">{hint}</span>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 min-h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm font-normal outline-none focus:border-brand"
        placeholder={placeholder}
      />
    </label>
  );
}
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input
        type="number"
        min="0"
        step="1000"
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value ? Number(e.target.value) : null)
        }
        className="mt-2 min-h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm font-normal outline-none focus:border-brand"
        placeholder="$"
      />
    </label>
  );
}

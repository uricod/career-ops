"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, LoaderCircle, UserPlus, UserX } from "lucide-react";

type Invitation = {
  id: string;
  email: string;
  status: string;
  daily_token_limit: number;
  expires_at: string;
  created_at: string;
};
type Member = {
  id: string;
  email: string;
  membership_status: string;
  daily_token_limit: number;
  created_at: string;
};

export function AdminConsole({
  invitations,
  members,
}: {
  invitations: Invitation[];
  members: Member[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [dailyTokenLimit, setDailyTokenLimit] = useState(20_000);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  async function createInvite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setInviteUrl("");
    try {
      const response = await fetch("/api/community/admin/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, dailyTokenLimit, expiresInDays }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Invite failed.");
      setInviteUrl(body.inviteUrl);
      setEmail("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invite failed.");
    } finally {
      setBusy(false);
    }
  }

  async function patch(body: Record<string, unknown>) {
    setError("");
    try {
      const response = await fetch("/api/community/admin/invitations", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Update failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Update failed. Check your connection and try again.");
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Copy failed. Select the invitation link manually.");
    }
  }

  return (
    <div className="space-y-10">
      <section className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-faint">
            Access control
          </p>
          <h2 className="mt-3 font-serif text-4xl text-landing">
            Invite one person.
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
            Each link is bound to one email, expires automatically, and becomes
            unusable after redemption.
          </p>
        </div>
        <form
          onSubmit={createInvite}
          className="rounded-2xl border border-border bg-surface p-5"
        >
          <label className="text-xs font-semibold">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-foreground/40"
              placeholder="member@example.org"
            />
          </label>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <NumberField
              label="Daily tokens"
              value={dailyTokenLimit}
              min={0}
              max={100000}
              onChange={setDailyTokenLimit}
            />
            <NumberField
              label="Expires in days"
              value={expiresInDays}
              min={1}
              max={30}
              onChange={setExpiresInDays}
            />
          </div>
          <button
            disabled={busy}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-foreground px-5 text-xs font-semibold text-background disabled:opacity-50"
          >
            {busy ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            Create invitation
          </button>
          {inviteUrl && (
            <div className="mt-4 rounded-xl bg-background p-3">
              <p className="truncate font-mono text-[10px] text-muted">
                {inviteUrl}
              </p>
              <button
                type="button"
                onClick={() => void copyInvite()}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold"
              >
                {copied ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copied ? "Copied" : "Copy private link"}
              </button>
            </div>
          )}
          {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
        </form>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Invitations</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface">
          {invitations.length === 0 ? (
            <p className="p-6 text-sm text-muted">No invitations yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="grid gap-3 p-4 text-xs sm:grid-cols-[1fr_auto_auto] sm:items-center"
                >
                  <div>
                    <p className="font-medium">{invitation.email}</p>
                    <p className="mt-1 text-faint">
                      Expires{" "}
                      {new Date(invitation.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-background px-2.5 py-1 capitalize text-muted">
                    {invitation.status}
                  </span>
                  {invitation.status === "pending" ? (
                    <button
                      onClick={() =>
                        void patch({
                          action: "revoke",
                          invitationId: invitation.id,
                        })
                      }
                      className="inline-flex items-center gap-1.5 text-rose-600"
                    >
                      <UserX className="size-3.5" /> Revoke
                    </button>
                  ) : (
                    <span className="w-14" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Members</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface">
          {members.length === 0 ? (
            <p className="p-6 text-sm text-muted">No members yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {members.map((member) => (
                <MemberRow key={member.id} member={member} onSave={patch} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function MemberRow({
  member,
  onSave,
}: {
  member: Member;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [limit, setLimit] = useState(member.daily_token_limit);
  const nextStatus =
    member.membership_status === "active" ? "suspended" : "active";
  return (
    <div className="grid gap-4 p-4 text-xs md:grid-cols-[1fr_150px_110px_auto] md:items-center">
      <div>
        <p className="font-medium">{member.email}</p>
        <p className="mt-1 capitalize text-faint">{member.membership_status}</p>
      </div>
      <input
        aria-label={`Daily token limit for ${member.email}`}
        type="number"
        min={0}
        max={100000}
        value={limit}
        onChange={(event) => setLimit(Number(event.target.value))}
        className="min-h-9 rounded-lg border border-border bg-background px-2 font-mono"
      />
      <button
        onClick={() =>
          void onSave({
            action: "member",
            userId: member.id,
            membershipStatus: member.membership_status,
            dailyTokenLimit: limit,
          })
        }
        className="min-h-9 rounded-lg border border-border px-3 font-semibold"
      >
        Save quota
      </button>
      <button
        onClick={() =>
          void onSave({
            action: "member",
            userId: member.id,
            membershipStatus: nextStatus,
            dailyTokenLimit: limit,
          })
        }
        className={
          nextStatus === "suspended" ? "text-rose-600" : "text-emerald-600"
        }
      >
        {nextStatus === "suspended" ? "Suspend" : "Reactivate"}
      </button>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-xs font-semibold">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        required
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 font-mono text-sm outline-none focus:border-foreground/40"
      />
    </label>
  );
}

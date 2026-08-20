import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  DatabaseZap,
  HeartHandshake,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { COMMUNITY_JOB_SOURCES } from "@/lib/community/sources";

export function CommunityLanding({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[700px] bg-[radial-gradient(circle_at_70%_15%,color-mix(in_srgb,var(--color-brand)_18%,transparent),transparent_35%),radial-gradient(circle_at_15%_5%,color-mix(in_srgb,var(--landing)_12%,transparent),transparent_30%)]" />
      <section className="relative mx-auto grid min-h-[680px] max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-[1.1fr_.9fr] lg:px-8">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1.5 text-xs font-medium text-muted shadow-sm backdrop-blur">
            <HeartHandshake className="size-3.5 text-brand" /> Built for public
            benefit, not application spam
          </div>
          <h1 className="max-w-4xl font-serif text-5xl leading-[0.98] tracking-[-0.045em] text-landing sm:text-7xl lg:text-[5.5rem]">
            A better job search should be{" "}
            <span className="font-serif-italic text-brand">free.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-muted sm:text-xl">
            Find promising roles, check your fit, and keep momentum—without
            giving away your resume or burning through a mystery AI bill.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href={signedIn ? "/community/jobs" : "/login"}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-6 font-semibold text-brand-foreground transition hover:bg-brand-200"
            >
              {signedIn ? "Find roles" : "Join free"}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/community/jobs"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-border bg-surface/70 px-6 font-semibold text-foreground transition hover:border-brand/40"
            >
              <Search className="size-4" />
              Browse job sources
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-faint">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-emerald-500" />
              No CV storage
            </span>
            <span className="inline-flex items-center gap-1.5">
              <DatabaseZap className="size-3.5 text-emerald-500" />
              Hard daily limits
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="size-3.5 text-emerald-500" />
              Human submits every application
            </span>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute -inset-10 rounded-full bg-brand/10 blur-3xl" />
          <div className="relative rotate-1 rounded-[2rem] border border-white/10 bg-[#12110f] p-3 shadow-[0_30px_100px_rgba(0,0,0,.35)]">
            <div className="rounded-[1.45rem] border border-white/10 bg-[#181715] p-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                    Today
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    Your search, in focus
                  </p>
                </div>
                <Sparkles className="size-5 text-[#fc8b51]" />
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2">
                {[
                  ["12", "fresh roles"],
                  ["3", "strong fits"],
                  ["84%", "AI left"],
                ].map(([n, label]) => (
                  <div key={label} className="rounded-2xl bg-white/[.06] p-3">
                    <div className="text-xl font-semibold">{n}</div>
                    <div className="mt-1 text-[10px] text-white/45">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {[
                  "Community Operations Lead",
                  "Data Analyst — Healthcare",
                  "Product Manager — Education",
                ].map((role, i) => (
                  <div
                    key={role}
                    className="flex items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.035] p-3.5"
                  >
                    <div className="grid size-9 place-items-center rounded-xl bg-[#dd7627]/15 text-xs font-bold text-[#fc8b51]">
                      {["CO", "DA", "PM"][i]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{role}</div>
                      <div className="mt-0.5 text-[11px] text-white/40">
                        Verified source · posted recently
                      </div>
                    </div>
                    <div className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-300">
                      {["4.4", "4.1", "3.9"][i]}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-2xl bg-[#dd7627]/10 p-3 text-xs text-[#f5b48b]">
                <BrainCircuit className="size-4" />
                You control every token and every application.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface/45">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-brand-text">
                Community reach
              </p>
              <h2 className="mt-2 font-serif text-4xl text-landing">
                One search. More of the places that matter.
              </h2>
            </div>
            <Link
              href="/community/jobs"
              className="text-sm font-semibold text-brand-text hover:underline"
            >
              See all {COMMUNITY_JOB_SOURCES.length} sources →
            </Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {COMMUNITY_JOB_SOURCES.slice(0, 6).map((source) => (
              <Link
                key={source.id}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="group rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{source.name}</span>
                  <ArrowRight className="size-4 text-faint transition group-hover:translate-x-1 group-hover:text-brand" />
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
                  {source.description}
                </p>
                <div className="mt-4 text-[11px] uppercase tracking-wider text-faint">
                  {source.coverage}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-20 text-center">
        <h2 className="font-serif text-4xl text-landing sm:text-5xl">
          Private by design. Useful by default.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted">
          We store the small amount of information needed to run your tracker
          and quota. Resume text, full job descriptions, prompts, and AI answers
          are not retained in our database.
        </p>
        <div className="mt-10 grid gap-4 text-left md:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "Your evidence only",
              body: "Fit checks may reframe what you provide, but never invent qualifications.",
            },
            {
              icon: DatabaseZap,
              title: "Visible limits",
              body: "Every request shows actual token use and your remaining daily allowance.",
            },
            {
              icon: HeartHandshake,
              title: "Quality over volume",
              body: "Low-fit roles get an honest skip recommendation. Applications are always yours to submit.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-surface p-6"
            >
              <Icon className="size-5 text-brand" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

import Link from "next/link";
import { ArrowUpRight, KeyRound } from "lucide-react";
import { COMMUNITY_NAME } from "@/lib/community/config";

export function CommunityLanding() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#f4f2ed] text-[#181815] dark:bg-[#10100f] dark:text-[#f2f0e9]">
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:28px_28px]" />
      <header className="relative flex items-center justify-between px-6 py-6 sm:px-10">
        <span className="text-sm font-semibold tracking-[-0.02em]">
          {COMMUNITY_NAME}
        </span>
        <span className="size-2 rounded-full bg-[#d66b32]" aria-hidden />
      </header>

      <section className="relative mx-auto flex w-full max-w-6xl flex-1 items-end px-6 pb-16 pt-24 sm:px-10 sm:pb-24">
        <div className="max-w-3xl">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-black/45 dark:text-white/45">
            Private access
          </p>
          <h1 className="font-serif text-5xl leading-[0.96] tracking-[-0.045em] sm:text-7xl lg:text-8xl">
            A quiet place to move forward.
          </h1>
          <p className="mt-7 max-w-md text-sm leading-6 text-black/55 dark:text-white/55">
            Membership is limited. If someone invited you, use the private link
            or code they shared.
          </p>
          <Link
            href="/login"
            className="mt-9 inline-flex min-h-12 items-center gap-3 rounded-full bg-[#181815] px-6 text-sm font-semibold text-white transition hover:translate-y-[-1px] dark:bg-[#f2f0e9] dark:text-[#181815]"
          >
            <KeyRound className="size-4" />
            Enter with an invitation
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>

      <footer className="relative flex items-center justify-between border-t border-black/10 px-6 py-5 text-[11px] text-black/40 dark:border-white/10 dark:text-white/40 sm:px-10">
        <span>Invitation only</span>
        <span>Private community</span>
      </footer>
    </main>
  );
}

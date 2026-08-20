"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BriefcaseBusiness,
  ClipboardCheck,
  Gauge,
  HeartHandshake,
  Search,
  UserRound,
} from "lucide-react";
import { CoMark } from "@/components/co-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/cn";
import { CommunityAuthButton } from "./community-auth-button";

const items = [
  { href: "/community", label: "Home", icon: HeartHandshake },
  { href: "/community/jobs", label: "Find jobs", icon: Search },
  { href: "/community/tracker", label: "My jobs", icon: BriefcaseBusiness },
  { href: "/community/fit", label: "Fit check", icon: ClipboardCheck },
  { href: "/community/usage", label: "Usage", icon: Gauge },
  { href: "/community/profile", label: "Profile", icon: UserRound },
];

export function CommunityShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = pathname.startsWith("/login") || pathname.startsWith("/auth/");
  if (isAuth)
    return <main className="min-h-screen overflow-hidden">{children}</main>;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-5 px-4 sm:px-6">
          <Link
            href="/community"
            className="flex shrink-0 items-center gap-2.5"
            aria-label="Career Ops Community home"
          >
            <CoMark size={31} />
            <span className="font-serif text-xl tracking-tight text-landing">
              career-ops
            </span>
            <span className="hidden rounded-full border border-brand/30 bg-brand-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-text sm:inline">
              community
            </span>
          </Link>
          <nav
            className="ml-auto hidden items-center gap-1 lg:flex"
            aria-label="Community navigation"
          >
            {items.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href ||
                (href !== "/community" && pathname.startsWith(`${href}/`));
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3.5 py-2 text-sm transition",
                    active
                      ? "bg-brand-soft text-brand-text"
                      : "text-muted hover:bg-surface hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-2">
            <Link
              href="/community/admin"
              className="hidden rounded-full p-2 text-faint transition hover:bg-surface hover:text-foreground sm:inline-flex"
              title="Nonprofit admin"
              aria-label="Nonprofit admin"
            >
              <BarChart3 className="size-4" />
            </Link>
            <ThemeToggle />
            <CommunityAuthButton />
          </div>
        </div>
      </header>
      <main>{children}</main>
      <nav
        className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-2xl border border-border bg-surface/95 p-1.5 shadow-2xl backdrop-blur-xl lg:hidden"
        aria-label="Mobile community navigation"
      >
        {items.slice(0, 5).map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-12 min-w-14 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-[10px] font-medium",
                active ? "bg-brand-soft text-brand-text" : "text-faint",
              )}
            >
              <Icon className="size-[18px]" />
              {label}
            </Link>
          );
        })}
      </nav>
      <footer className="border-t border-border px-4 pb-28 pt-10 text-center text-xs text-faint lg:pb-10">
        Free, privacy-minded job search for the community · We never submit
        applications for you.
      </footer>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleUserRound,
  Search,
  Gauge,
  ListTodo,
  ScanSearch,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { COMMUNITY_NAME } from "@/lib/community/config";
import { cn } from "@/lib/cn";
import { CommunityAuthButton } from "./community-auth-button";

const items = [
  { href: "/community/jobs", label: "Search", icon: Search },
  { href: "/community/tracker", label: "Board", icon: ListTodo },
  { href: "/community/fit", label: "Review", icon: ScanSearch },
  { href: "/community/usage", label: "Allowance", icon: Gauge },
  { href: "/community/profile", label: "Account", icon: CircleUserRound },
];

export function CommunityShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/");
  if (isPublic) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/92 backdrop-blur-xl">
        <div className="mx-auto flex h-15 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link
            href="/community"
            className="shrink-0 text-sm font-semibold tracking-tight"
          >
            {COMMUNITY_NAME}
          </Link>
          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Workspace"
          >
            {items.map(({ href, label }) => {
              const active =
                pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "rounded-lg px-3 py-2 text-xs font-medium transition",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted hover:bg-surface hover:text-foreground",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <CommunityAuthButton />
          </div>
        </div>
      </header>
      <main>{children}</main>
      <nav
        className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border border-border bg-surface/95 p-1.5 shadow-2xl backdrop-blur-xl md:hidden"
        aria-label="Workspace"
      >
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-medium",
                active ? "bg-foreground text-background" : "text-faint",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

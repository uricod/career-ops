import Link from "next/link";
import { ArrowRight, ListTodo, ScanSearch, Search } from "lucide-react";

export default function CommunityPage() {
  const actions = [
    {
      href: "/community/jobs",
      label: "Search",
      note: "Run every job source together",
      icon: Search,
    },
    {
      href: "/community/fit",
      label: "Review",
      note: "Check a role against your evidence",
      icon: ScanSearch,
    },
    {
      href: "/community/tracker",
      label: "Board",
      note: "Keep the next step visible",
      icon: ListTodo,
    },
  ];
  return (
    <div className="mx-auto max-w-6xl px-5 py-16 pb-28 sm:px-8">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-faint">
        Workspace
      </p>
      <h1 className="mt-3 max-w-2xl font-serif text-5xl leading-none tracking-tight text-landing sm:text-6xl">
        What needs your attention?
      </h1>
      <div className="mt-12 grid gap-3 md:grid-cols-3">
        {actions.map(({ href, label, note, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl border border-border bg-surface p-6 transition hover:border-foreground/25"
          >
            <Icon className="size-5 text-faint" />
            <div className="mt-12 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-semibold">{label}</h2>
                <p className="mt-1 text-xs text-muted">{note}</p>
              </div>
              <ArrowRight className="size-4 text-faint transition group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

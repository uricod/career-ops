import type { Metadata } from "next";
import { SourceBrowser } from "@/components/community/source-browser";

export const metadata: Metadata = {
  title: "Find jobs — Career Ops Community",
  description:
    "Search verified community job sources and public ATS boards for free.",
};
export default function CommunityJobsPage() {
  return <SourceBrowser />;
}

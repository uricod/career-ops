import type { Metadata } from "next";
import { JobSearchClient } from "@/components/community/job-search-client";

export const metadata: Metadata = {
  title: "Search jobs — Career Ops Community",
  description:
    "Run one private search across public ATS and community job boards.",
};
export default function CommunityJobsPage() {
  return <JobSearchClient />;
}

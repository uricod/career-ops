import { pipelineSummary, doctorState } from "@/lib/career-ops";
import { OnboardingBanner } from "@/components/onboarding-banner";
import { FirstRunHome } from "@/components/home/first-run-home";
import { TodayDashboard } from "@/components/home/today-dashboard";
import { CommunityLanding } from "@/components/community/community-landing";
import { COMMUNITY_MODE } from "@/lib/community/config";
import { getCommunityUser } from "@/lib/community/supabase-server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic"; // always read fresh local files at request time (never at build — CI has no user data)

export default async function Home() {
  if (COMMUNITY_MODE) {
    const { supabase, user } = await getCommunityUser();
    if (supabase && user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("membership_status")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.membership_status === "active") redirect("/community");
    }
    return <CommunityLanding />;
  }
  const { phase, onboardingNeeded } = doctorState();
  // First run (truly empty install): the CV-upload takeover IS the home — value
  // before commitment. The full dashboard returns once they have a CV or any data.
  if (phase === "first-run") return <FirstRunHome />;

  const { inbox, applications } = pipelineSummary();
  // Established / in-between: the dual-loop retention dashboard. Show the setup
  // banner whenever ANY prereq is missing (mirrors the core doctor.mjs), so a
  // portals-missing user is nudged rather than told "all caught up".
  return (
    <>
      {onboardingNeeded && <OnboardingBanner />}
      <TodayDashboard
        applications={applications}
        inbox={inbox}
        inBetween={phase === "in-between"}
      />
    </>
  );
}

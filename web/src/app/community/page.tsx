import { CommunityLanding } from "@/components/community/community-landing";
import { getCommunityUser } from "@/lib/community/supabase-server";
export const dynamic = "force-dynamic";
export default async function CommunityPage() {
  const { user } = await getCommunityUser();
  return <CommunityLanding signedIn={Boolean(user)} />;
}

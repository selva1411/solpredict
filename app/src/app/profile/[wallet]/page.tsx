import { getUserProfile, getPositions, getRecentActivity, getAchievements } from "@/lib/data/users";
import ProfileClient, {
  type UserProfile,
  type Position,
  type ActivityEntry,
  type Achievement,
} from "./ProfileClient";

export const dynamic = "force-dynamic";

/**
 * /profile/[wallet] — SERVER component.
 *
 * Prefetches the full profile payload (profile card, positions, recent
 * activity, achievements) directly from the DB — no client-side API round
 * trips on first load. All four datasets seed the client via React Query
 * `initialData`, so the first paint renders the real profile instantly; the
 * queries still refetch after their 30s staleTime to stay fresh.
 *
 * The data functions in lib/data/users.ts are the SAME ones the API routes
 * call, so the profile page and every API consumer render identical numbers.
 */
export default async function ProfileServerPage({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  const { wallet } = await params;

  let initialProfile: UserProfile | null = null;
  let initialPositions: Position[] = [];
  let initialActivities: ActivityEntry[] = [];
  let initialAchievements: Achievement[] = [];

  if (wallet && wallet.length >= 32 && wallet.length <= 44) {
    // Run the four queries in parallel; each is a single-row / indexed query.
    const [profileRes, positionsRes, activitiesRes, achievementsRes] = await Promise.allSettled([
      getUserProfile(wallet),
      getPositions(wallet),
      getRecentActivity(wallet, 50),
      getAchievements(wallet),
    ]);

    if (profileRes.status === "fulfilled" && profileRes.value) {
      // Data layer returns a superset (extra stats/tabs fields); the client
      // interface only consumes the profile card fields, so cast through
      // unknown (the shapes don't overlap exactly at the type level).
      initialProfile = profileRes.value.profile as unknown as UserProfile;
    }
    if (positionsRes.status === "fulfilled") {
      initialPositions = positionsRes.value as unknown as Position[];
    }
    if (activitiesRes.status === "fulfilled") {
      // Data layer returns blockTime as a Date; the client renders the same
      // field whether it arrives via RSC (Date) or the JSON API (ISO string).
      initialActivities = activitiesRes.value as unknown as ActivityEntry[];
    }
    if (achievementsRes.status === "fulfilled") {
      initialAchievements = achievementsRes.value as unknown as Achievement[];
    }
  }

  return (
    <ProfileClient
      wallet={wallet}
      initialProfile={initialProfile}
      initialPositions={initialPositions}
      initialActivities={initialActivities}
      initialAchievements={initialAchievements}
    />
  );
}

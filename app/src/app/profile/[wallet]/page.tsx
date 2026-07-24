// TODO Phase 6 — Public profile with positions, activity, followers
export default async function ProfilePage({ params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await params;
  return <h1>Profile: {wallet}</h1>;
}
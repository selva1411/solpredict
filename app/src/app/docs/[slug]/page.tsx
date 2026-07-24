// TODO Phase 6 — Help / docs center page
export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <h1>Docs: {slug}</h1>;
}
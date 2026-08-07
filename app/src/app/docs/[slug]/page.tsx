import Link from "next/link";
import { notFound } from "next/navigation";
import { DOC_ARTICLES, getDocArticle } from "@/lib/docs";

const ICON_GLYPH: Record<string, string> = {
  terminal: ">_",
  activity: "≈",
  candlestick: "⌁",
  coins: "◎",
  radar: "⌖",
  shield: "◆",
  settings: "⚙",
};

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (slug === "help" || slug === "index") {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div className="board-panel p-8">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#808495] mb-3">
            <span className="text-[#FFA500]">●</span> SOLPREDICT // HELP DESK
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#F4F4F9] tracking-tight">
            Documentation & Help
          </h1>
          <p className="mt-3 text-sm text-[#808495] leading-relaxed max-w-2xl">
            Guides for getting started, trading, claiming payouts, understanding
            the Pyth oracle, and the protocol&apos;s security safeguards.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {DOC_ARTICLES.map((article) => (
            <Link
              key={article.slug}
              href={`/docs/${article.slug}`}
              className="board-panel p-6 group transition-colors hover:border-[#FFA500]/50"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 flex items-center justify-center bg-[#FFA500]/10 border border-[#FFA500]/30 text-[#FFA500] font-mono text-sm">
                  {ICON_GLYPH[article.icon] ?? "▸"}
                </div>
                <h2 className="font-display text-lg font-semibold text-[#F4F4F9] group-hover:text-[#FFA500] transition-colors">
                  {article.title}
                </h2>
              </div>
              <p className="text-xs text-[#808495] leading-relaxed">{article.summary}</p>
              <div className="mt-4 font-mono text-[10px] uppercase tracking-widest text-[#D48800]">
                Open guide →
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const article = getDocArticle(slug);
  if (!article) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-6">
      <Link href="/docs/help" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#808495] hover:text-[#FFA500]">
        ← All guides
      </Link>

      <div className="board-panel p-8">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#808495] mb-3">
          <span className="text-[#FFA500]">●</span> SOLPREDICT // GUIDE
        </div>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 flex items-center justify-center bg-[#FFA500]/10 border border-[#FFA500]/30 text-[#FFA500] font-mono">
            {ICON_GLYPH[article.icon] ?? "▸"}
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F4F4F9] tracking-tight">
              {article.title}
            </h1>
            <p className="mt-2 text-sm text-[#808495]">{article.summary}</p>
          </div>
        </div>
      </div>

      {article.sections.map((section, i) => (
        <section key={section.heading} className="board-panel p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="font-mono text-[#FFA500] text-xs w-6">{String(i + 1).padStart(2, "0")}</span>
            <h2 className="font-display text-lg font-semibold text-[#F4F4F9]">{section.heading}</h2>
          </div>
          <p className="text-sm text-[#A5A8B8] leading-relaxed pl-9">{section.body}</p>
        </section>
      ))}
    </div>
  );
}

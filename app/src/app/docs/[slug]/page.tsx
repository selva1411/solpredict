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
  settings: "S",
};

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (slug === "help" || slug === "index") {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div className="board-panel p-8">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ash mb-3">
            <span className="text-gold">●</span> SOLPREDICT // HELP DESK
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-ivory tracking-tight">
            Documentation & Help
          </h1>
          <p className="mt-3 text-[13px] text-ash leading-relaxed max-w-2xl">
            Guides for getting started, trading, claiming payouts, understanding
            the Pyth oracle, and the protocol&apos;s security safeguards.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {DOC_ARTICLES.map((article) => (
            <Link
              key={article.slug}
              href={`/docs/${article.slug}`}
              className="board-panel p-6 group transition-colors hover:border-gold/50"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 flex items-center justify-center bg-gold/10 border border-gold/30 text-gold font-mono text-[13px]">
                  {ICON_GLYPH[article.icon] ?? "▸"}
                </div>
                <h2 className="font-display text-[21px] font-semibold text-ivory group-hover:text-gold transition-colors">
                  {article.title}
                </h2>
              </div>
              <p className="text-xs text-ash leading-relaxed">{article.summary}</p>
              <div className="mt-4 font-mono text-[10px] uppercase tracking-widest text-gold-deep">
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
      <Link href="/docs/help" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-ash hover:text-gold">
        ← All guides
      </Link>

      <div className="board-panel p-8">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ash mb-3">
          <span className="text-gold">●</span> SOLPREDICT // GUIDE
        </div>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 flex items-center justify-center bg-gold/10 border border-gold/30 text-gold font-mono">
            {ICON_GLYPH[article.icon] ?? "▸"}
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ivory tracking-tight">
              {article.title}
            </h1>
            <p className="mt-2 text-[13px] text-ash">{article.summary}</p>
          </div>
        </div>
      </div>

      {article.sections.map((section, i) => (
        <section key={section.heading} className="board-panel p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="font-mono text-gold text-xs w-6">{String(i + 1).padStart(2, "0")}</span>
            <h2 className="font-display text-[21px] font-semibold text-ivory">{section.heading}</h2>
          </div>
          <p className="text-[13px] text-[#A5A8B8] leading-relaxed pl-9">{section.body}</p>
        </section>
      ))}
    </div>
  );
}

import { ArrowRight, BookOpen, Clock3, Feather, Layers3 } from "lucide-react";
import Link from "next/link";
import { LibraryFooter, LibraryNav, moduleLabel } from "@/components/library-chrome";
import { getBlog } from "@/lib/blog";
import type { ArticleModule, ArticleSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Library — InkTelligence",
  description:
    "Thirty research papers on tattoo styles, techniques, history, and anthropology — the documented basis of the InkTelligence compendium.",
};

const moduleOrder: ArticleModule[] = ["styles", "techniques", "history"];

const moduleIntros: Record<ArticleModule, string> = {
  styles: "Ten papers covering all 66 catalogued styles — genealogy, visual grammar, cultural authority, and how each ages.",
  techniques: "Ten papers covering all 44 catalogued techniques — needle, motion, pigment, and healed behaviour.",
  history: "Ten papers on evidence, encounter, subculture, and the marked body — how tattooing is studied, not just admired.",
};

export default async function BlogIndexPage() {
  const { articles } = await getBlog();
  const totalWords = articles.reduce((sum, article) => sum + article.wordCount, 0);
  const documented = new Set(articles.flatMap((article) => article.catalogIds)).size;

  return (
    <main className="library-page">
      <LibraryNav />

      <header className="library-hero">
        <span className="landing-kicker"><i /> The library · research corpus</span>
        <h1>Thirty papers.<br /><em>One living archive.</em></h1>
        <p>
          Every style and technique in the compendium is documented by a citation-grounded paper. This is that
          corpus, opened for reading — evidence first, aesthetics second.
        </p>
        <div className="library-stats">
          <div><strong>{articles.length}</strong><span>papers</span></div>
          <div><strong>{documented}</strong><span>entries documented</span></div>
          <div><strong>{Math.round(totalWords / 1000)}k</strong><span>words</span></div>
        </div>
      </header>

      {moduleOrder.map((module) => {
        const group = articles.filter((article) => article.module === module);
        if (!group.length) return null;
        return (
          <section className="library-module" key={module}>
            <div className="library-module-head">
              <div>
                <span className="eyebrow">{moduleLabel(module)}</span>
                <h2>{moduleIntros[module]}</h2>
              </div>
              <span className="library-module-count">{String(group.length).padStart(2, "0")}</span>
            </div>
            <div className="library-grid">
              {group.map((article) => <ArticleCard article={article} key={article.id} />)}
            </div>
          </section>
        );
      })}

      <LibraryFooter />
    </main>
  );
}

function ArticleCard({ article }: { article: ArticleSummary }) {
  return (
    <Link className="library-card" href={`/blog/${article.slug}`}>
      <div className="library-card-top">
        <span>{article.id}</span>
        <small><Clock3 size={12} /> {article.readingMinutes} min</small>
      </div>
      <h3>{article.title}</h3>
      <p className="library-card-dek">{article.dek}</p>
      <blockquote className="library-card-note"><Feather size={13} />{article.curatorNote}</blockquote>
      <div className="library-card-tags">
        {article.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
      </div>
      <div className="library-card-foot">
        {article.catalogIds.length > 0 && (
          <span><Layers3 size={13} /> {article.catalogIds.length} entries</span>
        )}
        {article.catalogIds.length === 0 && <span><BookOpen size={13} /> Framework paper</span>}
        <ArrowRight size={15} />
      </div>
    </Link>
  );
}

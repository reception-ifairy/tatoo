import { ArrowLeft, Clock3, Feather, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LibraryFooter, LibraryNav, moduleLabel } from "@/components/library-chrome";
import { getArticle, getBlog } from "@/lib/blog";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const { articles } = await getBlog();
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const article = await getArticle((await params).slug);
  if (!article) return { title: "Not found — InkTelligence" };
  return { title: `${article.title} — InkTelligence Library`, description: article.dek };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const article = await getArticle((await params).slug);
  if (!article) notFound();

  return (
    <main className="library-page">
      <LibraryNav />

      <article className="article-shell">
        <Link className="article-back" href="/blog"><ArrowLeft size={15} /> The Library</Link>

        <header className="article-head">
          <div className="article-kicker">
            <span>{article.id}</span>
            <small>{moduleLabel(article.module)}</small>
          </div>
          <h1>{article.title}</h1>
          <p className="article-dek">{article.dek}</p>
          <div className="article-meta">
            <span><Clock3 size={13} /> {article.readingMinutes} min read</span>
            <i />
            <span>{article.wordCount.toLocaleString("en-US")} words</span>
            <i />
            <span>{article.publishedAt}</span>
          </div>
          <p className="article-paper-title">Paper: {article.paperTitle}</p>
        </header>

        <aside className="article-curator">
          <div className="article-curator-mark"><Feather size={17} /></div>
          <div>
            <span className="eyebrow">From Alexei&rsquo;s desk</span>
            <p>{article.curatorNote}</p>
          </div>
        </aside>

        {article.entries.length > 0 && (
          <section className="article-entries">
            <span className="eyebrow">Catalog entries documented here</span>
            <div className="article-entry-chips">
              {article.entries.map((entry) => <span key={entry.id}>{entry.name}</span>)}
            </div>
          </section>
        )}

        <div className="article-body markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{stripLeadingTitle(article.body)}</ReactMarkdown>
        </div>

        <footer className="article-foot">
          <ShieldCheck size={16} />
          <p>
            Claims in this paper carry evidence labels (<em>direct</em>, <em>synthesized</em>,{" "}
            <em>community_attested</em>, <em>contested</em>, <em>hypothesis</em>, <em>unknown</em>). Where the
            sources disagree, the disagreement is recorded rather than resolved. Living cultural traditions
            remain under the authority of their communities.
          </p>
        </footer>
      </article>

      <LibraryFooter />
    </main>
  );
}

/** The page renders its own title, so drop the paper's leading H1. */
function stripLeadingTitle(body: string): string {
  return body.replace(/^\s*#\s+[^\n]*\n+/, "");
}

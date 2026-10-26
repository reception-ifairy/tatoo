import { ArrowDown, ArrowRight, BookOpen, BrainCircuit, CircleDot, Clock3, Feather, Layers3, LockKeyhole, PenTool, ScanLine, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ArticleSummary } from "@/lib/types";

const packages = [
  {
    number: "01",
    name: "Seeker",
    audience: "For a first meaningful tattoo",
    price: "€12",
    description: "A guided path from personal story to a clear, artist-ready tattoo direction.",
    future: "Future: 20 image studies",
    features: ["AI consultation", "Full style compendium", "Placement & longevity guidance"],
  },
  {
    number: "02",
    name: "Collector",
    audience: "For people building a body of work",
    price: "€29",
    description: "Deeper concept development, saved projects, and room to compare visual directions.",
    future: "Future: 100 image studies",
    features: ["Everything in Seeker", "Saved tattoo projects", "Style fusion planning"],
  },
  {
    number: "03",
    name: "Studio",
    audience: "For artists and creative studios",
    price: "€79",
    description: "A professional workspace for client discovery, briefs, references, and image exploration.",
    future: "Future: 400 image studies",
    features: ["Everything in Collector", "Client workspaces", "Reusable studio briefs"],
  },
];

export function PublicLanding({ featured, libraryCount }: { featured: ArticleSummary[]; libraryCount: number }) {
  return (
    <main className="public-landing">
      <nav className="landing-nav" aria-label="Primary navigation">
        <Link className="landing-brand" href="/" aria-label="InkTelligence home">
          <span><PenTool size={20} /></span><strong>InkTelligence</strong><small>stories written in skin</small>
        </Link>
        <div className="library-nav-links">
          <Link href="/blog">The Library</Link>
          <Link className="landing-login" href="/login"><LockKeyhole size={15} /> Login</Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-orbit orbit-one" /><div className="landing-orbit orbit-two" />
        <div className="landing-hero-copy">
          <span className="landing-kicker"><i /> Tattoo intelligence · coming to life</span>
          <h1>Your story.<br /><em>Written in skin.</em></h1>
          <p>InkTelligence is a private design ritual becoming a platform — where meaning, anthropology, anatomy, and tattoo craft meet before the first line is drawn.</p>
          <div className="landing-status"><span><i /> Private alpha</span><span>66 styles indexed</span><span>44 techniques mapped</span></div>
        </div>
        <LandingTotem />
        <a className="landing-scroll" href="#manifesto" aria-label="Read more"><ArrowDown size={16} /></a>
      </section>

      <section className="landing-manifesto" id="manifesto">
        <div className="manifesto-index">01 / THE IDEA</div>
        <div><span className="eyebrow">Before the needle</span><h2>A tattoo should begin<br />with a question, <em>not a trend.</em></h2></div>
        <div className="manifesto-copy"><p>Most tools begin with a prompt. We begin with the person: what the mark should protect, remember, release, or celebrate.</p><p>Then we connect that meaning to visual language, body flow, cultural context, technique, and the way ink changes over time.</p></div>
      </section>

      <section className="landing-system">
        <header><span className="eyebrow">One intelligence · four disciplines</span><h2>Not a generator.<br /><em>A thinking atelier.</em></h2></header>
        <div className="system-grid">
          <article><BrainCircuit size={24} /><span>01</span><h3>Story</h3><p>An intimate consultation translates lived experience into symbolic direction.</p></article>
          <article><BookOpen size={24} /><span>02</span><h3>History</h3><p>A living archive keeps every visual choice connected to origins and context.</p></article>
          <article><ScanLine size={24} /><span>03</span><h3>Anatomy</h3><p>Composition follows movement, placement, line longevity, and the body’s architecture.</p></article>
          <article><Layers3 size={24} /><span>04</span><h3>Craft</h3><p>Styles and techniques become a practical brief a real artist can build upon.</p></article>
        </div>
      </section>

      <section className="landing-archive">
        <div className="archive-visual"><span className="archive-ring ring-a" /><span className="archive-ring ring-b" /><span className="archive-core"><Feather size={42} /></span><small>3300 BCE → NOW</small></div>
        <div className="archive-copy"><span className="eyebrow">A living historical database</span><h2>Every style carries<br /><em>someone’s history.</em></h2><p>From Copper Age markings and Sāmoan tatau to Irezumi, Chicano fine-line, blackwork, and digital-era sigilism — the archive treats tattooing as culture before it treats it as aesthetic.</p><div><span>6 historical eras</span><span>4 anthropological lenses</span><span>110 craft entries</span></div></div>
      </section>

      <section className="landing-library">
        <header>
          <div>
            <span className="eyebrow">From the library · {libraryCount} papers</span>
            <h2>The evidence<br /><em>behind the atlas.</em></h2>
          </div>
          <p>Every style and technique we catalogue is documented by a citation-grounded paper, with disputes recorded rather than smoothed away. The corpus is open to read.</p>
        </header>
        <div className="landing-library-grid">
          {featured.map((article) => (
            <Link className="landing-library-card" href={`/blog/${article.slug}`} key={article.id}>
              <div className="landing-library-top"><span>{article.id}</span><small><Clock3 size={12} /> {article.readingMinutes} min</small></div>
              <h3>{article.title}</h3>
              <p>{article.dek}</p>
              <blockquote><Feather size={13} />{article.curatorNote}</blockquote>
              <span className="landing-library-link">Read the paper <ArrowRight size={14} /></span>
            </Link>
          ))}
        </div>
        <Link className="landing-library-all" href="/blog">Enter the library <ArrowRight size={16} /></Link>
      </section>

      <section className="landing-packages">
        <header><div><span className="eyebrow">Membership architecture · preview</span><h2>Three paths into<br /><em>the atelier.</em></h2></div><p>The accounts and image studio are still sleeping. These packages describe the platform we are preparing — no billing is active today.</p></header>
        <div className="package-grid">
          {packages.map((item) => <article key={item.name} className={item.name === "Collector" ? "featured" : ""}>
            <div className="package-top"><span>{item.number}</span><small>Coming later</small></div>
            <h3>{item.name}</h3><em>{item.audience}</em><p>{item.description}</p>
            <ul>{item.features.map((feature) => <li key={feature}><CircleDot size={11} />{feature}</li>)}</ul>
            <div className="package-future"><Sparkles size={14} /> {item.future}</div>
            <div className="package-price"><strong>{item.price}</strong><span>/ month<br />proposed</span></div>
          </article>)}
        </div>
      </section>

      <footer className="landing-footer">
        <div><span className="landing-brand"><span><PenTool size={18} /></span><strong>InkTelligence</strong></span><h2>The skin listens<br />more than <em>you think.</em></h2></div>
        <div className="footer-note"><span>Private alpha · Barcelona / Everywhere</span><p>Built for thoughtful marks, cultural integrity, and the human artist who brings the final work to life.</p><small>© 2026 InkTelligence</small></div>
      </footer>
    </main>
  );
}

function LandingTotem() {
  return <div className="landing-totem" aria-hidden="true"><svg viewBox="0 0 430 600"><path className="totem-faint" d="M215 26C102 64 44 166 78 270c22 66 75 100 137 116 62-16 115-50 137-116 34-104-24-206-137-244Z"/><path className="totem-line" d="M215 62c-68 29-108 87-96 146 8 39 35 67 72 82-15-31-12-70 24-102 36 32 39 71 24 102 37-15 64-43 72-82 12-59-28-117-96-146Zm0 126v322m-88-118c47 3 76 24 88 64m88-64c-47 3-76 24-88 64M137 161c38-37 118-37 156 0M153 526c40-31 84-31 124 0"/><path className="totem-red" d="M215 92c-31 20-51 50-51 76 0 24 16 42 38 47-8-25 0-49 13-64 13 15 21 39 13 64 22-5 38-23 38-47 0-26-20-56-51-76Z"/><circle cx="215" cy="222" r="9"/><path className="totem-rays" d="M215 0v22m144 38-17 17m64 145h-24M71 60l17 17M24 222H0M215 554v39"/></svg><span>MEANING · FORM · SKIN</span></div>;
}

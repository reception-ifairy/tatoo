"use client";

import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  Database,
  ExternalLink,
  Feather,
  Flower2,
  History,
  Clock3,
  Landmark,
  Layers3,
  Library,
  LogOut,
  Menu,
  MessageCircle,
  PenTool,
  Search,
  ShieldCheck,
  Skull,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type {
  ArticleSummary,
  ChatMessage,
  CompendiumData,
  HistoryData,
  KeyFact,
  MixedStyle,
  TattooStyle,
  TattooTechnique,
} from "@/lib/types";

type MainView = "chat" | "history" | "compendium" | "library";
type CompendiumView = "styles" | "techniques" | "fusions";
type SelectedEntry =
  | { kind: "style"; item: TattooStyle }
  | { kind: "technique"; item: TattooTechnique }
  | { kind: "fusion"; item: MixedStyle };

const welcomeMessage: ChatMessage = {
  role: "assistant",
  content: "Hello. I’m **Alexei “Inkseer” Novak**. Let’s not begin with the image yet — let’s begin with what deserves to stay with you on your skin.\n\nI can guide you from emotion and symbol through style, anatomy, and longevity, all the way to a studio-ready brief. **What brought you to ink today?**",
};

const suggestions = [
  "I want a tattoo to close an important chapter",
  "Which styles age best?",
  "Tell me about Cyber Sigilism",
  "Help me build a design prompt",
];

const culturalStyles = new Set(["maori", "polynesian", "samoan", "marquesan", "haida", "aztec_maya", "religious", "tribal", "irezumi", "tebori_style"]);

export function InkTelligenceApp({ initialData, initialHistory, articles, owner }: { initialData: CompendiumData; initialHistory: HistoryData; articles: ArticleSummary[]; owner: { displayName: string; role: string } }) {
  const [view, setView] = useState<MainView>("chat");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compendiumFocus, setCompendiumFocus] = useState<string | null>(null);

  const changeView = (next: MainView) => {
    setView(next);
    setCompendiumFocus(null);
    setMobileMenuOpen(false);
  };

  const openCompendium = (styleId?: string) => {
    setCompendiumFocus(styleId || null);
    setView("compendium");
    setMobileMenuOpen(false);
  };

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        onChange={changeView}
        data={initialData}
        owner={owner}
        mobileOpen={mobileMenuOpen}
      />
      {mobileMenuOpen && <button className="nav-scrim" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} />}

      <main className="app-main">
        <header className="mobile-header">
          <Brand compact />
          <button className="icon-button" onClick={() => setMobileMenuOpen((open) => !open)} aria-label="Open menu">
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>
        {view === "chat" && <ChatWorkspace data={initialData} onOpenCompendium={() => openCompendium()} />}
        {view === "history" && <HistoryWorkspace data={initialData} history={initialHistory} onOpenCompendium={openCompendium} />}
        {view === "compendium" && <CompendiumWorkspace key={`compendium-${compendiumFocus || "all"}`} data={initialData} focusId={compendiumFocus} />}
        {view === "library" && <LibraryWorkspace articles={articles} />}
      </main>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <NavButton active={view === "chat"} icon={<MessageCircle size={18} />} label="Consult" onClick={() => changeView("chat")} compact />
        <NavButton active={view === "history"} icon={<History size={18} />} label="History" onClick={() => changeView("history")} compact />
        <NavButton active={view === "compendium"} icon={<BookOpen size={18} />} label="Atlas" onClick={() => changeView("compendium")} compact />
        <NavButton active={view === "library"} icon={<Library size={18} />} label="Library" onClick={() => changeView("library")} compact />
      </nav>
    </div>
  );
}

function Sidebar({
  view,
  onChange,
  data,
  owner,
  mobileOpen,
}: {
  view: MainView;
  onChange: (view: MainView) => void;
  data: CompendiumData;
  owner: { displayName: string; role: string };
  mobileOpen: boolean;
}) {
  return (
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <Brand />

      <div className="sidebar-section">
        <span className="eyebrow">The studio</span>
        <nav className="side-nav">
          <NavButton active={view === "chat"} icon={<MessageCircle size={19} />} label="AI Consultation" onClick={() => onChange("chat")} />
          <NavButton active={view === "history"} icon={<History size={19} />} label="History & Anthropology" onClick={() => onChange("history")} />
          <NavButton active={view === "compendium"} icon={<BookOpen size={19} />} label="Style Compendium" onClick={() => onChange("compendium")} />
          <NavButton active={view === "library"} icon={<Library size={19} />} label="Research Library" onClick={() => onChange("library")} />
        </nav>
      </div>

      <div className="sidebar-spacer" />

      <div className="inkseer-card">
        <div className="inkseer-orbit"><Feather size={22} /></div>
        <span className="eyebrow">Your advisor</span>
        <strong>Alexei „Inkseer”</strong>
        <p>Artist, educator, and visual storyteller. Barcelona.</p>
        <div className="persona-traits"><span>ISFP</span><span>ENGLISH ONLY</span></div>
      </div>

      <div className="database-status">
        <span className={`status-dot ${data.source}`} />
        <div>
          <strong>{data.source === "sql" ? "T1000 connected" : "JSON mode"}</strong>
          <small>v{data.version} · {data.styles.length + data.techniques.length} entries</small>
        </div>
        <Database size={17} />
      </div>
      <button className="owner-logout" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.assign("/"); }}>
        <span><strong>{owner.displayName}</strong><small>{owner.role.replace("_", " ")}</small></span><LogOut size={16} />
      </button>
    </aside>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand-compact" : ""}`}>
      <div className="brand-mark"><PenTool size={compact ? 18 : 21} /></div>
      <div>
        <strong>InkTelligence</strong>
        {!compact && <span>stories written in skin</span>}
      </div>
    </div>
  );
}

function NavButton({ active, icon, label, onClick, compact = false }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void; compact?: boolean }) {
  return (
    <button className={`nav-button ${active ? "active" : ""} ${compact ? "compact" : ""}`} onClick={onClick}>
      {icon}<span>{label}</span>{!compact && <ChevronRight className="nav-chevron" size={16} />}
    </button>
  );
}

function ChatWorkspace({ data, onOpenCompendium }: { data: CompendiumData; onOpenCompendium: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionId(crypto.randomUUID());
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(rawText: string) {
    const text = rawText.trim();
    if (!text || loading) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.slice(-12), sessionId: sessionId || undefined }),
      });
      const payload = await response.json() as { answer?: string; error?: string };
      if (!response.ok || !payload.answer) throw new Error(payload.error || "No response was received.");
      setMessages((current) => [...current, { role: "assistant", content: payload.answer! }]);
    } catch (error) {
      setMessages((current) => [...current, {
        role: "assistant",
        content: `⚠️ ${error instanceof Error ? error.message : "Could not connect to Alexei."}`,
      }]);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <section className="chat-workspace">
      <div className="chat-topbar">
        <div>
          <span className="eyebrow">Consultation 01</span>
          <h1>From story to form</h1>
        </div>
        <div className="phase-indicator" aria-label="Consultation phase">
          <span className="active">1</span><i /><span>2</span><i /><span>3</span><i /><span>4</span><i /><span>5</span><i /><span>6</span>
        </div>
        <button className="ghost-button" onClick={onOpenCompendium}><BookOpen size={16} /> Open the atlas</button>
      </div>

      <div className="chat-scroll">
        <div className="chat-intro">
          <span className="intro-kicker"><Sparkles size={14} /> private consultation</span>
          <h2>Every lasting tattoo<br />begins <em>before the line.</em></h2>
          <p>Alexei listens to the story before speaking about style, guiding you through symbol, anatomy, technique, and the life of the design.</p>
          <div className="intro-stats">
            <Stat value={String(data.styles.length)} label="styles" />
            <Stat value={String(data.techniques.length)} label="techniques" />
            <Stat value="6" label="phases" />
          </div>
        </div>

        <div className="conversation" aria-live="polite">
          {messages.map((message, index) => <MessageBubble key={`${message.role}-${index}`} message={message} />)}
          {loading && <LoadingMessage />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="chat-composer-area">
        {messages.length <= 2 && (
          <div className="suggestions">
            {suggestions.map((suggestion) => <button key={suggestion} onClick={() => void sendMessage(suggestion)}>{suggestion}<ArrowRight size={13} /></button>)}
          </div>
        )}
        <form className="composer" onSubmit={submit}>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (input.trim()) void sendMessage(input);
              }
            }}
            rows={1}
            maxLength={5000}
            placeholder="Tell Alexei what you have been carrying…"
            aria-label="Message Alexei"
          />
          <button type="submit" className="send-button" disabled={!input.trim() || loading} aria-label="Send message"><ArrowUp size={19} /></button>
        </form>
        <p className="composer-note"><ShieldCheck size={12} /> Alexei offers design guidance. Entrust skin assessment and application to a licensed professional.</p>
      </div>
    </section>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") return <div className="message-row user"><div className="message-bubble user">{message.content}</div></div>;
  return (
    <div className="message-row assistant">
      <div className="alexei-avatar"><Feather size={17} /></div>
      <div className="message-content">
        <span className="message-author">Alexei <i>Inkseer</i></span>
        <div className="message-bubble assistant markdown"><ReactMarkdown skipHtml>{message.content}</ReactMarkdown></div>
      </div>
    </div>
  );
}

function LoadingMessage() {
  return (
    <div className="message-row assistant">
      <div className="alexei-avatar"><Feather size={17} /></div>
      <div className="message-content"><span className="message-author">Alexei <i>is thinking in ink…</i></span><div className="typing"><i /><i /><i /></div></div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function HistoryWorkspace({ data, history, onOpenCompendium }: { data: CompendiumData; history: HistoryData; onOpenCompendium: (styleId?: string) => void }) {
  const lensIcon = { landmark: <Landmark size={20} />, sparkles: <Sparkles size={20} />, skull: <Skull size={20} />, flower: <Flower2 size={20} /> };

  const styleName = (id: string) => data.styles.find((style) => style.id === id)?.name || id;

  return (
    <section className="history-workspace">
      <header className="history-hero">
        <div className="history-hero-copy">
          <span className="intro-kicker"><History size={14} /> history · anthropology · living practice</span>
          <h1>The human body<br />as a <em>living archive.</em></h1>
          <p>Tattooing has no single origin story. It is a constellation of technologies, rituals, identities, aesthetics, and acts of remembrance — written in skin across time.</p>
          <button className="history-cta" onClick={() => onOpenCompendium()}><BookOpen size={17} /> Explore all {data.styles.length} styles <ArrowRight size={16} /></button>
        </div>
        <FlashSeal />
      </header>

      <div className="history-intro">
        <span className="chapter-number">I</span>
        <div><span className="eyebrow">A note on reading history</span><h2>Not a straight line. A field of encounters.</h2></div>
        <p>Archaeology can show us pigment and tools; anthropology asks what marks do within a culture. Neither lets us flatten living traditions into a universal “tribal” aesthetic. Follow the evidence, name the community, and treat revival as continuity — not trend.</p>
      </div>

      <div className="timeline" aria-label="Tattoo history timeline">
        {history.periods.map((era, index) => (
          <article className="timeline-entry" key={era.title}>
            <div className="timeline-marker"><span>{String(index + 1).padStart(2, "0")}</span></div>
            <div className="timeline-date">{era.dateLabel}</div>
            <div className="timeline-body">
              <h3>{era.title}</h3>
              <p>{era.summary}</p>
              <div className="timeline-links">
                {era.sourceLabel && era.sourceUrl && <a href={era.sourceUrl} target="_blank" rel="noreferrer">{era.sourceLabel}<ExternalLink size={13} /></a>}
                {era.styleIds.map((id) => <button key={id} onClick={() => onOpenCompendium(id)}>{styleName(id)}<ChevronRight size={13} /></button>)}
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="anthropology-section">
        <div className="section-heading"><span className="chapter-number">II</span><div><span className="eyebrow">Anthropology of the marked body</span><h2>Four lenses for every style</h2></div></div>
        <div className="lens-grid">
          {history.anthropologyLenses.map((lens, index) => <article key={lens.title}><div className="lens-icon">{lensIcon[lens.icon]}</div><small>Lens {String(index + 1).padStart(2, "0")}</small><h3>{lens.title}</h3><p>{lens.description}</p></article>)}
        </div>
      </section>

      <section className="history-compendium-callout">
        <div><span className="intro-kicker"><BookOpen size={14} /> continue the story</span><h2>History becomes legible<br />through <em>style.</em></h2></div>
        <p>Open any compendium entry to connect origin, visual grammar, motifs, technique, related styles, and cultural context. The atlas is designed as the next chapter of this history.</p>
        <button onClick={() => onOpenCompendium()}>Enter the compendium <ArrowRight size={16} /></button>
      </section>
    </section>
  );
}

function FlashSeal() {
  return (
    <div className="flash-seal" aria-hidden="true">
      <svg viewBox="0 0 360 440" role="img">
        <path className="seal-halo" d="M180 27C111 27 55 83 55 152c0 52 32 96 77 115-28 35-34 85-9 126M180 27c69 0 125 56 125 125 0 52-32 96-77 115 28 35 34 85 9 126" />
        <path className="seal-main" d="M180 67c-63 29-88 79-66 122 14 27 45 31 66 13 21 18 52 14 66-13 22-43-3-93-66-122Zm0 135v172m-59-88c32 4 49 18 59 43m59-43c-32 4-49 18-59 43M140 126c16-17 64-17 80 0m-91 253c33-22 69-22 102 0" />
        <path className="seal-red" d="M180 88c-22 12-38 32-38 51 0 15 10 27 24 30-5-16 1-32 14-44 13 12 19 28 14 44 14-3 24-15 24-30 0-19-16-39-38-51Z" />
        <circle className="seal-dot" cx="180" cy="157" r="7" />
        <path className="seal-rays" d="M180 12V0m93 45 9-9m24 112h13M87 45l-9-9M54 148H41M180 408v25" />
      </svg>
      <span>EST. BEFORE HISTORY</span>
    </div>
  );
}

function LibraryWorkspace({ articles }: { articles: ArticleSummary[] }) {
  const [module, setModule] = useState<"all" | ArticleSummary["module"]>("all");
  const filtered = module === "all" ? articles : articles.filter((article) => article.module === module);
  const labels = { all: "All papers", styles: "Styles", techniques: "Techniques", history: "History" } as const;

  return (
    <section className="library-workspace">
      <div className="compendium-hero">
        <div>
          <span className="intro-kicker"><Library size={14} /> research corpus</span>
          <h1>The evidence<br /><em>behind every entry.</em></h1>
          <p>Thirty citation-grounded papers documenting all 66 styles and 44 techniques. Alexei draws his facts from here — and flags where the sources disagree.</p>
        </div>
        <div className="compendium-counts">
          <Stat value={String(articles.length)} label="papers" />
          <Stat value={String(new Set(articles.flatMap((article) => article.catalogIds)).size)} label="entries" />
          <Stat value={`${Math.round(articles.reduce((sum, article) => sum + article.wordCount, 0) / 1000)}k`} label="words" />
        </div>
      </div>

      <div className="catalog-toolbar">
        <div className="catalog-tabs">
          {(["all", "styles", "techniques", "history"] as const).map((key) => (
            <CatalogTab
              key={key}
              active={module === key}
              onClick={() => setModule(key)}
              icon={<BookOpen size={16} />}
              label={labels[key]}
              count={key === "all" ? articles.length : articles.filter((article) => article.module === key).length}
            />
          ))}
        </div>
      </div>

      <div className="catalog-grid library-workspace-grid">
        {filtered.map((article) => (
          <Link className="catalog-card library-workspace-card" href={`/blog/${article.slug}`} key={article.id}>
            <div className="card-topline"><span>{article.id}</span><small><Clock3 size={12} /> {article.readingMinutes} min</small></div>
            <h3>{article.title}</h3>
            <p>{article.dek}</p>
            <blockquote className="library-card-note"><Feather size={13} />{article.curatorNote}</blockquote>
            <div className="card-footer">
              <span><Layers3 size={14} /> {article.catalogIds.length || "framework"} {article.catalogIds.length ? "entries" : ""}</span>
              <ExternalLink size={15} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function CompendiumWorkspace({ data, focusId }: { data: CompendiumData; focusId?: string | null }) {
  const [tab, setTab] = useState<CompendiumView>("styles");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<SelectedEntry | null>(() => {
    const style = focusId ? data.styles.find((item) => item.id === focusId) : undefined;
    return style ? { kind: "style", item: style } : null;
  });

  const filteredStyles = useMemo(() => data.styles.filter((item) => {
    const haystack = `${item.name} ${item.categoryName} ${item.description} ${item.history} ${item.motifs.join(" ")}`.toLowerCase();
    return (category === "all" || item.categoryId === category) && haystack.includes(query.toLowerCase());
  }), [data.styles, query, category]);

  const filteredTechniques = useMemo(() => data.techniques.filter((item) => {
    const haystack = `${item.name} ${item.categoryName} ${item.description} ${item.usedInStyles.map((style) => style.name).join(" ")}`.toLowerCase();
    return (category === "all" || item.categoryId === category) && haystack.includes(query.toLowerCase());
  }), [data.techniques, query, category]);

  const filteredFusions = useMemo(() => data.mixedStyles.filter((item) => `${item.name} ${item.components.map((part) => part.name).join(" ")}`.toLowerCase().includes(query.toLowerCase())), [data.mixedStyles, query]);
  const categories = tab === "styles" ? data.categories : data.techniqueCategories;
  const resultCount = tab === "styles" ? filteredStyles.length : tab === "techniques" ? filteredTechniques.length : filteredFusions.length;
  const activeCategory = category === "all" ? null : categories.find((item) => item.id === category) || null;

  return (
    <section className="compendium-workspace">
      <div className="compendium-hero">
        <div>
          <span className="intro-kicker"><Database size={14} /> master tattoo classification</span>
          <h1>An atlas of languages<br /><em>written in ink.</em></h1>
          <p>History, form, craft, and cultural context — joined in the living compendium Alexei draws from during every consultation.</p>
        </div>
        <div className="compendium-counts">
          <Stat value={String(data.styles.length)} label="styles" />
          <Stat value={String(data.techniques.length)} label="techniques" />
          <Stat value={String(data.mixedStyles.length)} label="fusions" />
          <small><span className={`status-dot ${data.source}`} /> {data.source === "sql" ? "T1000 live data" : "JSON fallback"}</small>
        </div>
      </div>

      <div className="catalog-toolbar">
        <div className="catalog-tabs">
          <CatalogTab active={tab === "styles"} onClick={() => { setTab("styles"); setCategory("all"); }} icon={<Layers3 size={16} />} label="Style" count={data.styles.length} />
          <CatalogTab active={tab === "techniques"} onClick={() => { setTab("techniques"); setCategory("all"); }} icon={<WandSparkles size={16} />} label="Techniques" count={data.techniques.length} />
          <CatalogTab active={tab === "fusions"} onClick={() => { setTab("fusions"); setCategory("all"); }} icon={<Sparkles size={16} />} label="Fusions" count={data.mixedStyles.length} />
        </div>
        <div className="catalog-controls">
          <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search style, motif, or technique…" /></label>
          {tab !== "fusions" && (
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category filter">
              <option value="all">All categories</option>
              {categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="catalog-summary"><span>{resultCount} {tab === "styles" ? "styles" : tab === "techniques" ? "techniques" : "fusions"}</span><i /> <span>version {data.version}</span></div>

      {activeCategory && (
        <aside className="category-note">
          <span className="eyebrow">{activeCategory.name}</span>
          <p>{activeCategory.description}</p>
        </aside>
      )}

      <div className={`catalog-grid ${tab === "fusions" ? "fusions-grid" : ""}`}>
        {tab === "styles" && filteredStyles.map((item, index) => <StyleCard item={item} index={index} key={item.id} onClick={() => setSelected({ kind: "style", item })} />)}
        {tab === "techniques" && filteredTechniques.map((item, index) => <TechniqueCard item={item} index={index} key={item.id} onClick={() => setSelected({ kind: "technique", item })} />)}
        {tab === "fusions" && filteredFusions.map((item, index) => <FusionCard item={item} index={index} key={item.id} onClick={() => setSelected({ kind: "fusion", item })} />)}
      </div>
      {resultCount === 0 && <div className="empty-state"><Search size={25} /><h3>No mark found.</h3><p>Try another name or motif, or clear the category filter.</p></div>}

      {selected && <DetailModal selected={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

function CatalogTab({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number }) {
  return <button className={active ? "active" : ""} onClick={onClick}>{icon}<span>{label}</span><small>{count}</small></button>;
}

function StyleCard({ item, index, onClick }: { item: TattooStyle; index: number; onClick: () => void }) {
  return (
    <button className="catalog-card" onClick={onClick} style={{ "--delay": `${Math.min(index, 12) * 35}ms` } as React.CSSProperties}>
      <div className="card-topline"><span>{item.categoryName}</span><small>{String(index + 1).padStart(2, "0")}</small></div>
      <h3>{item.name}</h3>
      <p>{item.description}</p>
      <div className="card-tags">{item.motifs.slice(0, 3).map((motif) => <span key={motif}>{motif}</span>)}</div>
      <div className="card-footer">
        <span><PenTool size={14} /> {item.techniques.length} techniques</span>
        {culturalStyles.has(item.id) && <span className="cultural-mark"><ShieldCheck size={14} /> context</span>}
        <ChevronRight size={17} />
      </div>
    </button>
  );
}

function TechniqueCard({ item, index, onClick }: { item: TattooTechnique; index: number; onClick: () => void }) {
  return (
    <button className="catalog-card technique-card" onClick={onClick} style={{ "--delay": `${Math.min(index, 12) * 35}ms` } as React.CSSProperties}>
      <div className="card-topline"><span>{item.categoryName}</span><span className={`difficulty ${item.difficulty}`}>{difficultyLabel(item.difficulty)}</span></div>
      <div className="technique-glyph"><WandSparkles size={20} /></div>
      <h3>{item.name}</h3>
      <p>{item.description}</p>
      <div className="card-footer"><span><Layers3 size={14} /> {item.usedInStyles.length} uses</span><ChevronRight size={17} /></div>
    </button>
  );
}

function FusionCard({ item, index, onClick }: { item: MixedStyle; index: number; onClick: () => void }) {
  return (
    <button className="fusion-card" onClick={onClick} style={{ "--delay": `${index * 50}ms` } as React.CSSProperties}>
      <div className="fusion-number">F.{String(index + 1).padStart(2, "0")}</div>
      <div className="fusion-symbol"><span /><Sparkles size={19} /><span /></div>
      <h3>{item.name}</h3>
      <div className="fusion-components">{item.components.map((part) => <span key={part.id}>{part.name}</span>)}</div>
      <p>{item.narrativeDescription}</p>
      <div className="fusion-link">Explore the fusion <ArrowRight size={15} /></div>
    </button>
  );
}

function DetailModal({ selected, onClose }: { selected: SelectedEntry; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => { document.removeEventListener("keydown", onKey); document.body.classList.remove("modal-open"); };
  }, [onClose]);

  const item = selected.item;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <article className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <div className="modal-kicker">{selected.kind === "style" ? "tattoo style" : selected.kind === "technique" ? "application technique" : "style fusion"}</div>
        <h2 id="detail-title">{item.name}</h2>

        {selected.kind === "style" && <StyleDetail item={selected.item} />}
        {selected.kind === "technique" && <TechniqueDetail item={selected.item} />}
        {selected.kind === "fusion" && <FusionDetail item={selected.item} />}
      </article>
    </div>
  );
}

function StyleDetail({ item }: { item: TattooStyle }) {
  return (
    <>
      <div className="detail-lead">{item.narrativeDescription}</div>
      <FieldNote note={item.fieldNote} />
      {culturalStyles.has(item.id) && <div className="context-note"><CircleAlert size={19} /><div><strong>Cultural integrity</strong><p>This visual language may carry genealogical, ritual, or religious meaning. Alexei recommends consulting an artist from the tradition and building respectful inspiration instead of copying restricted marks.</p></div></div>}
      <div className="detail-grid">
        <DetailSection icon={<History size={17} />} title="History"><p>{item.history}</p></DetailSection>
        <DetailSection icon={<Feather size={17} />} title="Defining features"><p>{item.distinctFeatures}</p></DetailSection>
      </div>
      <KeyFacts facts={item.keyFacts} />
      <DetailSection title="Motifs"><div className="detail-chips">{item.motifs.map((motif) => <span key={motif}>{motif}</span>)}</div></DetailSection>
      <DetailSection title="Techniques"><div className="reference-list">{item.techniques.map((technique) => <span key={technique.id}><Check size={13} />{technique.name}</span>)}</div></DetailSection>
      {item.relatedStyles.length > 0 && <DetailSection title="Related styles"><div className="detail-chips accent">{item.relatedStyles.map((style) => <span key={style.id}>{style.name}</span>)}</div></DetailSection>}
      <SourcePaper article={item.sourceArticle} />
    </>
  );
}

function TechniqueDetail({ item }: { item: TattooTechnique }) {
  return (
    <>
      <div className="modal-meta"><span>{item.categoryName}</span><span className={`difficulty ${item.difficulty}`}>{difficultyLabel(item.difficulty)}</span></div>
      <div className="detail-lead">{item.narrativeDescription}</div>
      <FieldNote note={item.fieldNote} />
      <DetailSection icon={<WandSparkles size={17} />} title="How it works"><p>{item.description}</p></DetailSection>
      <KeyFacts facts={item.keyFacts} />
      <DetailSection title="Styles that use it"><div className="detail-chips accent">{item.usedInStyles.map((style) => <span key={style.id}>{style.name}</span>)}</div></DetailSection>
      <SourcePaper article={item.sourceArticle} />
    </>
  );
}

/** Alexei's one-line reading of the entry. */
function FieldNote({ note }: { note: string | null }) {
  if (!note) return null;
  return (
    <blockquote className="field-note">
      <Feather size={14} />
      <p>{note}</p>
      <cite>Alexei &ldquo;Inkseer&rdquo;</cite>
    </blockquote>
  );
}

/** Paper-grounded claims, each carrying its evidence label. */
function KeyFacts({ facts }: { facts: KeyFact[] }) {
  if (!facts.length) return null;
  return (
    <DetailSection icon={<ShieldCheck size={17} />} title="Documented facts">
      <ul className="key-facts">
        {facts.map((fact) => (
          <li key={fact.text}>
            <span className={`evidence evidence-${fact.evidence}`}>{fact.evidence.replace("_", " ")}</span>
            <p>{fact.text}</p>
          </li>
        ))}
      </ul>
    </DetailSection>
  );
}

function SourcePaper({ article }: { article: TattooStyle["sourceArticle"] }) {
  if (!article) return null;
  return (
    <Link className="source-paper" href={`/blog/${article.slug}`}>
      <BookOpen size={15} />
      <span><small>{article.id} · source paper</small><strong>{article.title}</strong></span>
      <ExternalLink size={14} />
    </Link>
  );
}

function FusionDetail({ item }: { item: MixedStyle }) {
  return (
    <>
      <div className="detail-lead">{item.narrativeDescription}</div>
      <div className="fusion-equation">{item.components.map((part, index) => <div key={part.id}>{index > 0 && <Sparkles size={17} />}<span>{part.name}</span></div>)}</div>
      <DetailSection title="Composition principle"><p>Each component should remain legible, while line rhythm, contrast, and anatomy bind the whole into one design. A fusion is not a collage — it is a new dialect.</p></DetailSection>
    </>
  );
}

function DetailSection({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section className="detail-section"><h4>{icon}{title}</h4>{children}</section>;
}

function difficultyLabel(value: string) {
  return ({ basic: "basic", beginner: "beginner", intermediate: "intermediate", advanced: "advanced", expert: "expert" } as Record<string, string>)[value] || value;
}

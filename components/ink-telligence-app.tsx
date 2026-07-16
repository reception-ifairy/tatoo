"use client";

import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  Database,
  Feather,
  History,
  Layers3,
  Menu,
  MessageCircle,
  PenTool,
  Search,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type {
  ChatMessage,
  CompendiumData,
  MixedStyle,
  TattooStyle,
  TattooTechnique,
} from "@/lib/types";

type MainView = "chat" | "compendium";
type CompendiumView = "styles" | "techniques" | "fusions";
type SelectedEntry =
  | { kind: "style"; item: TattooStyle }
  | { kind: "technique"; item: TattooTechnique }
  | { kind: "fusion"; item: MixedStyle };

const welcomeMessage: ChatMessage = {
  role: "assistant",
  content: "Cześć. Jestem **Alexei „Inkseer” Novak**. Nie zaczynajmy jeszcze od obrazu — zacznijmy od tego, co ma zostać z Tobą na skórze.\n\nMogę przeprowadzić Cię od emocji i symbolu, przez styl, anatomię i trwałość, aż po gotowy brief dla tatuatora. **Co przyprowadziło Cię dziś do tuszu?**",
};

const suggestions = [
  "Chcę tatuaż o zamknięciu ważnego etapu",
  "Które style najlepiej się starzeją?",
  "Opowiedz mi o Cyber Sigilism",
  "Pomóż mi stworzyć prompt do projektu",
];

const culturalStyles = new Set(["maori", "polynesian", "samoan", "marquesan", "haida", "aztec_maya", "religious", "tribal", "irezumi", "tebori_style"]);

export function InkTelligenceApp({ initialData }: { initialData: CompendiumData }) {
  const [view, setView] = useState<MainView>("chat");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        onChange={(next) => { setView(next); setMobileMenuOpen(false); }}
        data={initialData}
        mobileOpen={mobileMenuOpen}
      />
      {mobileMenuOpen && <button className="nav-scrim" aria-label="Zamknij menu" onClick={() => setMobileMenuOpen(false)} />}

      <main className="app-main">
        <header className="mobile-header">
          <Brand compact />
          <button className="icon-button" onClick={() => setMobileMenuOpen((open) => !open)} aria-label="Otwórz menu">
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>
        {view === "chat" ? <ChatWorkspace data={initialData} onOpenCompendium={() => setView("compendium")} /> : <CompendiumWorkspace data={initialData} />}
      </main>

      <nav className="mobile-bottom-nav" aria-label="Nawigacja mobilna">
        <NavButton active={view === "chat"} icon={<MessageCircle size={18} />} label="Konsultacja" onClick={() => setView("chat")} compact />
        <NavButton active={view === "compendium"} icon={<BookOpen size={18} />} label="Kompendium" onClick={() => setView("compendium")} compact />
      </nav>
    </div>
  );
}

function Sidebar({
  view,
  onChange,
  data,
  mobileOpen,
}: {
  view: MainView;
  onChange: (view: MainView) => void;
  data: CompendiumData;
  mobileOpen: boolean;
}) {
  return (
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <Brand />

      <div className="sidebar-section">
        <span className="eyebrow">Pracownia</span>
        <nav className="side-nav">
          <NavButton active={view === "chat"} icon={<MessageCircle size={19} />} label="Konsultacja AI" onClick={() => onChange("chat")} />
          <NavButton active={view === "compendium"} icon={<BookOpen size={19} />} label="Kompendium" onClick={() => onChange("compendium")} />
        </nav>
      </div>

      <div className="sidebar-spacer" />

      <div className="inkseer-card">
        <div className="inkseer-orbit"><Feather size={22} /></div>
        <span className="eyebrow">Twój doradca</span>
        <strong>Alexei „Inkseer”</strong>
        <p>Artysta, edukator i narrator wizualny. Barcelona.</p>
        <div className="persona-traits"><span>ISFP</span><span>PL · EN · ES</span></div>
      </div>

      <div className="database-status">
        <span className={`status-dot ${data.source}`} />
        <div>
          <strong>{data.source === "sql" ? "T1000 połączona" : "Tryb JSON"}</strong>
          <small>v{data.version} · {data.styles.length + data.techniques.length} wpisów</small>
        </div>
        <Database size={17} />
      </div>
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
      if (!response.ok || !payload.answer) throw new Error(payload.error || "Nie udało się uzyskać odpowiedzi.");
      setMessages((current) => [...current, { role: "assistant", content: payload.answer! }]);
    } catch (error) {
      setMessages((current) => [...current, {
        role: "assistant",
        content: `⚠️ ${error instanceof Error ? error.message : "Nie udało się połączyć z Alexeiem."}`,
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
          <span className="eyebrow">Konsultacja 01</span>
          <h1>Od historii do formy</h1>
        </div>
        <div className="phase-indicator" aria-label="Etap konsultacji">
          <span className="active">1</span><i /><span>2</span><i /><span>3</span><i /><span>4</span><i /><span>5</span><i /><span>6</span>
        </div>
        <button className="ghost-button" onClick={onOpenCompendium}><BookOpen size={16} /> Otwórz bazę</button>
      </div>

      <div className="chat-scroll">
        <div className="chat-intro">
          <span className="intro-kicker"><Sparkles size={14} /> prywatna konsultacja</span>
          <h2>Każdy dobry tatuaż<br />zaczyna się <em>przed linią.</em></h2>
          <p>Alexei słucha historii, zanim zacznie mówić o stylu. Prowadzi spokojnie przez symbol, anatomię, technikę i trwałość projektu.</p>
          <div className="intro-stats">
            <Stat value={String(data.styles.length)} label="stylów" />
            <Stat value={String(data.techniques.length)} label="technik" />
            <Stat value="6" label="etapów" />
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
            placeholder="Opowiedz Alexeiowi, co nosisz w głowie…"
            aria-label="Wiadomość do Alexeia"
          />
          <button type="submit" className="send-button" disabled={!input.trim() || loading} aria-label="Wyślij wiadomość"><ArrowUp size={19} /></button>
        </form>
        <p className="composer-note"><ShieldCheck size={12} /> Alexei doradza projektowo. Ostateczną ocenę skóry i zabieg powierz licencjonowanemu artyście.</p>
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
      <div className="message-content"><span className="message-author">Alexei <i>myśli tuszem…</i></span><div className="typing"><i /><i /><i /></div></div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function CompendiumWorkspace({ data }: { data: CompendiumData }) {
  const [tab, setTab] = useState<CompendiumView>("styles");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<SelectedEntry | null>(null);

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

  return (
    <section className="compendium-workspace">
      <div className="compendium-hero">
        <div>
          <span className="intro-kicker"><Database size={14} /> master tattoo classification</span>
          <h1>Atlas języków<br /><em>pisanych tuszem.</em></h1>
          <p>Historia, forma, warsztat i kulturowy kontekst — połączone w kompendium, z którego korzysta Alexei podczas konsultacji.</p>
        </div>
        <div className="compendium-counts">
          <Stat value={String(data.styles.length)} label="style" />
          <Stat value={String(data.techniques.length)} label="techniki" />
          <Stat value={String(data.mixedStyles.length)} label="fuzje" />
          <small><span className={`status-dot ${data.source}`} /> {data.source === "sql" ? "Dane z T1000" : "Fallback JSON"}</small>
        </div>
      </div>

      <div className="catalog-toolbar">
        <div className="catalog-tabs">
          <CatalogTab active={tab === "styles"} onClick={() => { setTab("styles"); setCategory("all"); }} icon={<Layers3 size={16} />} label="Style" count={data.styles.length} />
          <CatalogTab active={tab === "techniques"} onClick={() => { setTab("techniques"); setCategory("all"); }} icon={<WandSparkles size={16} />} label="Techniki" count={data.techniques.length} />
          <CatalogTab active={tab === "fusions"} onClick={() => { setTab("fusions"); setCategory("all"); }} icon={<Sparkles size={16} />} label="Fuzje" count={data.mixedStyles.length} />
        </div>
        <div className="catalog-controls">
          <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj stylu, motywu, techniki…" /></label>
          {tab !== "fusions" && (
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filtr kategorii">
              <option value="all">Wszystkie kategorie</option>
              {categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="catalog-summary"><span>{resultCount} {tab === "styles" ? "stylów" : tab === "techniques" ? "technik" : "fuzji"}</span><i /> <span>wersja {data.version}</span></div>

      <div className={`catalog-grid ${tab === "fusions" ? "fusions-grid" : ""}`}>
        {tab === "styles" && filteredStyles.map((item, index) => <StyleCard item={item} index={index} key={item.id} onClick={() => setSelected({ kind: "style", item })} />)}
        {tab === "techniques" && filteredTechniques.map((item, index) => <TechniqueCard item={item} index={index} key={item.id} onClick={() => setSelected({ kind: "technique", item })} />)}
        {tab === "fusions" && filteredFusions.map((item, index) => <FusionCard item={item} index={index} key={item.id} onClick={() => setSelected({ kind: "fusion", item })} />)}
      </div>
      {resultCount === 0 && <div className="empty-state"><Search size={25} /><h3>Nie znaleziono takiego śladu.</h3><p>Spróbuj innej nazwy, motywu albo wyczyść kategorię.</p></div>}

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
        <span><PenTool size={14} /> {item.techniques.length} technik</span>
        {culturalStyles.has(item.id) && <span className="cultural-mark"><ShieldCheck size={14} /> kontekst</span>}
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
      <div className="card-footer"><span><Layers3 size={14} /> {item.usedInStyles.length} zastosowań</span><ChevronRight size={17} /></div>
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
      <div className="fusion-link">Odkryj połączenie <ArrowRight size={15} /></div>
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
        <button className="modal-close" onClick={onClose} aria-label="Zamknij"><X size={19} /></button>
        <div className="modal-kicker">{selected.kind === "style" ? "styl tatuażu" : selected.kind === "technique" ? "technika wykonania" : "fuzja stylów"}</div>
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
      {culturalStyles.has(item.id) && <div className="context-note"><CircleAlert size={19} /><div><strong>Integralność kulturowa</strong><p>Ten język wizualny może nieść znaczenie rodowe, rytualne lub religijne. Alexei zaleca konsultację z artystą należącym do danej tradycji i tworzenie inspiracji zamiast kopii.</p></div></div>}
      <div className="detail-grid">
        <DetailSection icon={<History size={17} />} title="Historia"><p>{item.history}</p></DetailSection>
        <DetailSection icon={<Feather size={17} />} title="Cechy rozpoznawcze"><p>{item.distinctFeatures}</p></DetailSection>
      </div>
      <DetailSection title="Motywy"><div className="detail-chips">{item.motifs.map((motif) => <span key={motif}>{motif}</span>)}</div></DetailSection>
      <DetailSection title="Techniki"><div className="reference-list">{item.techniques.map((technique) => <span key={technique.id}><Check size={13} />{technique.name}</span>)}</div></DetailSection>
      {item.relatedStyles.length > 0 && <DetailSection title="Style pokrewne"><div className="detail-chips accent">{item.relatedStyles.map((style) => <span key={style.id}>{style.name}</span>)}</div></DetailSection>}
    </>
  );
}

function TechniqueDetail({ item }: { item: TattooTechnique }) {
  return (
    <>
      <div className="modal-meta"><span>{item.categoryName}</span><span className={`difficulty ${item.difficulty}`}>{difficultyLabel(item.difficulty)}</span></div>
      <div className="detail-lead">{item.narrativeDescription}</div>
      <DetailSection icon={<WandSparkles size={17} />} title="Jak działa"><p>{item.description}</p></DetailSection>
      <DetailSection title="Style, w których pracuje"><div className="detail-chips accent">{item.usedInStyles.map((style) => <span key={style.id}>{style.name}</span>)}</div></DetailSection>
    </>
  );
}

function FusionDetail({ item }: { item: MixedStyle }) {
  return (
    <>
      <div className="detail-lead">{item.narrativeDescription}</div>
      <div className="fusion-equation">{item.components.map((part, index) => <div key={part.id}>{index > 0 && <Sparkles size={17} />}<span>{part.name}</span></div>)}</div>
      <DetailSection title="Zasada kompozycji"><p>Każdy komponent powinien pozostać czytelny, ale rytm linii, kontrast i anatomia muszą spiąć całość w jeden projekt. Fuzja nie jest kolażem — jest nowym dialektem.</p></DetailSection>
    </>
  );
}

function DetailSection({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section className="detail-section"><h4>{icon}{title}</h4>{children}</section>;
}

function difficultyLabel(value: string) {
  return ({ basic: "podstawowa", beginner: "początkująca", intermediate: "średnia", advanced: "zaawansowana", expert: "ekspercka" } as Record<string, string>)[value] || value;
}

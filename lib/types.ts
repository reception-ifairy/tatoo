export type DataSource = "sql" | "json";

export interface Category {
  id: string;
  name: string;
  description: string;
}

export interface ReferenceItem {
  id: string;
  name: string;
}

/** Evidence labels defined by the research corpus plan. */
export type EvidenceLabel =
  | "direct"
  | "synthesized"
  | "community_attested"
  | "contested"
  | "hypothesis"
  | "unknown";

/** A single paper-grounded claim carried with its evidence label. */
export interface KeyFact {
  text: string;
  evidence: EvidenceLabel;
}

/** Pointer from a catalog entry back to the library article that documents it. */
export interface ArticleRef {
  id: string;
  slug: string;
  title: string;
}

export interface TattooStyle {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  description: string;
  history: string;
  distinctFeatures: string;
  narrativeDescription: string;
  motifs: string[];
  techniques: ReferenceItem[];
  relatedStyles: ReferenceItem[];
  fieldNote: string | null;
  keyFacts: KeyFact[];
  sourceArticle: ArticleRef | null;
}

export interface TattooTechnique {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  description: string;
  difficulty: string;
  narrativeDescription: string;
  usedInStyles: ReferenceItem[];
  fieldNote: string | null;
  keyFacts: KeyFact[];
  sourceArticle: ArticleRef | null;
}

export interface MixedStyle {
  id: string;
  name: string;
  description: string;
  narrativeDescription: string;
  components: ReferenceItem[];
}

export interface CompendiumData {
  source: DataSource;
  version: string;
  updatedAt: string;
  categories: Category[];
  techniqueCategories: Category[];
  styles: TattooStyle[];
  techniques: TattooTechnique[];
  mixedStyles: MixedStyle[];
}

/** Which arm of the research corpus an article belongs to. */
export type ArticleModule = "styles" | "techniques" | "history";

/** Library article metadata — the paper as a readable, linkable piece. */
export interface ArticleSummary {
  id: string;
  slug: string;
  module: ArticleModule;
  order: number;
  title: string;
  paperTitle: string;
  dek: string;
  curatorNote: string;
  tags: string[];
  wordCount: number;
  readingMinutes: number;
  publishedAt: string;
  catalogIds: string[];
}

/** A full article: metadata plus the paper's markdown body. */
export interface Article extends ArticleSummary {
  body: string;
  entries: ReferenceItem[];
}

export interface BlogData {
  source: DataSource;
  articles: ArticleSummary[];
}

export interface HistoryPeriod {
  id: string;
  displayOrder: number;
  dateLabel: string;
  title: string;
  summary: string;
  sourceLabel: string | null;
  sourceUrl: string | null;
  styleIds: string[];
}

export interface AnthropologyLens {
  id: string;
  displayOrder: number;
  title: string;
  description: string;
  icon: "landmark" | "sparkles" | "skull" | "flower";
}

export interface HistoryData {
  source: DataSource;
  periods: HistoryPeriod[];
  anthropologyLenses: AnthropologyLens[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AlexeiRuntime {
  persona: Record<string, unknown>;
  knowledgeBase: Record<string, unknown>;
  systemPrompt: string;
  imagePromptTemplate: string;
  source: DataSource;
}

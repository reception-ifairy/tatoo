// The tattoo compendium (content/compendium.json): styles, techniques, fusions, history and the research library
// index, carried over from the Ink Master archive. The server loads it once (server/compendium.ts); the client
// gets it from GET /api/compendium. Article bodies (content/library/*.md) are fetched one by one.

export type Evidence = 'direct' | 'synthesized' | 'community_attested' | 'contested' | 'hypothesis' | 'unknown';

export interface KeyFact {
  text: string;
  evidence: Evidence;
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

export interface TattooStyle {
  id: string;
  name: string;
  category: string;
  description: string;
  history: string;
  distinctFeatures: string;
  commonMotifs: string[];
  relatedTechniques: string[];
  relatedStyles: string[];
  sourcePaper: string;
  fieldNote: string;
  keyFacts: KeyFact[];
}

export interface TattooTechnique {
  id: string;
  name: string;
  category: string;
  description: string;
  usedInStyles: string[];
  difficulty: string;
  sourcePaper: string;
  fieldNote: string;
  keyFacts: KeyFact[];
}

export interface Fusion {
  combination: string[];
  name: string;
}

export interface HistoryPeriod {
  id: string;
  displayOrder: number;
  dateLabel: string;
  title: string;
  summary: string;
  sourceLabel: string;
  sourceUrl: string;
  styleIds: string[];
}

export interface AnthropologyLens {
  id: string;
  displayOrder: number;
  title: string;
  description: string;
  icon: string;
}

export interface Article {
  id: string;
  slug: string;
  module: string;
  order: number;
  title: string;
  paperTitle: string;
  dek: string;
  curatorNote: string;
  tags: string[];
  file: string;
  wordCount: number;
  readingMinutes: number;
  publishedAt: string;
  catalogIds: string[];
}

export interface Compendium {
  meta: { name: string; version: string; date: string; counts: Record<string, number> };
  styleCategories: Category[];
  styles: TattooStyle[];
  techniqueCategories: Category[];
  techniques: TattooTechnique[];
  mixedStyles: { description: string; examples: Fusion[] };
  history: { periods: HistoryPeriod[]; anthropologyLenses: AnthropologyLens[] };
  articles: Article[];
}

/**
 * Living or sacred traditions. "closed": marks that belong to a people and carry lineage — never reproduced, only an
 * openly "inspired, not copied" abstraction. "sensitive": traditions with religious or cultural weight that ask for
 * care and context.
 */
export const CLOSED_STYLES = new Set(['maori', 'polynesian', 'samoan', 'marquesan', 'haida']);
export const SENSITIVE_STYLES = new Set(['aztec_maya', 'religious', 'tribal', 'irezumi', 'tebori_style']);

export function culturalLevel(styleId: string | null | undefined): 'closed' | 'sensitive' | null {
  if (!styleId) return null;
  if (CLOSED_STYLES.has(styleId)) return 'closed';
  if (SENSITIVE_STYLES.has(styleId)) return 'sensitive';
  return null;
}

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  direct: 'Direct evidence',
  synthesized: 'Synthesised',
  community_attested: 'Community-attested',
  contested: 'Contested',
  hypothesis: 'Hypothesis',
  unknown: 'Unknown',
};

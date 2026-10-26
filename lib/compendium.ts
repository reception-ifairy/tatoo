import type { RowDataPacket } from "mysql2";
import sourceDatabase from "@/scripts/database/tattoo_database.backup.json";
import { getDbPool, parseJson } from "@/lib/db";
import type {
  ArticleRef,
  Category,
  CompendiumData,
  EvidenceLabel,
  KeyFact,
  MixedStyle,
  ReferenceItem,
  TattooStyle,
  TattooTechnique,
} from "@/lib/types";

/** Enrichment carried in each entry's mirrored source payload. */
interface EntryEnrichment {
  sourcePaper?: string;
  fieldNote?: string;
  keyFacts?: Array<{ text: string; evidence: string }>;
}

const EVIDENCE_LABELS: ReadonlySet<string> = new Set<EvidenceLabel>([
  "direct",
  "synthesized",
  "community_attested",
  "contested",
  "hypothesis",
  "unknown",
]);

function asEvidenceLabel(value: string): EvidenceLabel {
  return EVIDENCE_LABELS.has(value) ? (value as EvidenceLabel) : "unknown";
}

type JsonDatabase = typeof sourceDatabase;

interface StyleRow extends RowDataPacket {
  style_id: string;
  name: string;
  category_id: string;
  category_name: string;
  description: string;
  history: string;
  distinct_features: string;
  narrative_description: string;
  source_payload: unknown;
}

interface TechniqueRow extends RowDataPacket {
  technique_id: string;
  name: string;
  category_id: string;
  category_name: string;
  description: string;
  difficulty: string;
  narrative_description: string;
  source_payload: unknown;
}

interface ArticleRefRow extends RowDataPacket {
  article_id: string;
  slug: string;
  title: string;
}

interface RelationRow extends RowDataPacket {
  owner_id: string;
  item_id: string;
  item_name: string;
}

export async function getCompendium(): Promise<CompendiumData> {
  try {
    return await getSqlCompendium();
  } catch (error) {
    console.warn("[InkTelligence] SQL unavailable; using tattoo_database.json.", error instanceof Error ? error.message : error);
    return getJsonCompendium(sourceDatabase);
  }
}

async function getSqlCompendium(): Promise<CompendiumData> {
  const pool = getDbPool();
  const [
    [manifestRows],
    [categoryRows],
    [techniqueCategoryRows],
    [styleRows],
    [techniqueRows],
    [motifRows],
    [styleTechniqueRows],
    [relatedStyleRows],
    [usageRows],
    [mixedRows],
    [componentRows],
    [articleRefRows],
  ] = await Promise.all([
    pool.query<RowDataPacket[]>("SELECT source_version, source_date FROM import_manifest WHERE manifest_id = 1"),
    pool.query<RowDataPacket[]>("SELECT category_id, name, description FROM style_categories ORDER BY name"),
    pool.query<RowDataPacket[]>("SELECT category_id, name, description FROM technique_categories ORDER BY name"),
    pool.query<StyleRow[]>("SELECT * FROM v_compendium_styles ORDER BY name"),
    pool.query<TechniqueRow[]>("SELECT * FROM v_compendium_techniques ORDER BY name"),
    pool.query<RowDataPacket[]>("SELECT style_id AS owner_id, motif AS item_name FROM style_motifs ORDER BY style_id, display_order"),
    pool.query<RelationRow[]>(`SELECT st.style_id AS owner_id, t.technique_id AS item_id, t.name AS item_name
      FROM style_techniques st JOIN techniques t ON t.technique_id = st.technique_id
      ORDER BY st.style_id, st.display_order`),
    pool.query<RelationRow[]>(`SELECT rs.style_id AS owner_id, s.style_id AS item_id, s.name AS item_name
      FROM related_styles rs JOIN styles s ON s.style_id = rs.related_style_id
      ORDER BY rs.style_id, rs.display_order`),
    pool.query<RelationRow[]>(`SELECT tsu.technique_id AS owner_id, s.style_id AS item_id, s.name AS item_name
      FROM technique_style_usage tsu JOIN styles s ON s.style_id = tsu.style_id
      ORDER BY tsu.technique_id, tsu.display_order`),
    pool.query<RowDataPacket[]>("SELECT mixed_style_id, name, description, narrative_description FROM mixed_styles ORDER BY name"),
    pool.query<RelationRow[]>(`SELECT msc.mixed_style_id AS owner_id, msc.component_id AS item_id,
      COALESCE(s.name, t.name, msc.component_id) AS item_name
      FROM mixed_style_components msc
      LEFT JOIN styles s ON s.style_id = msc.component_id
      LEFT JOIN techniques t ON t.technique_id = msc.component_id
      ORDER BY msc.mixed_style_id, msc.component_order`),
    pool.query<ArticleRefRow[]>("SELECT article_id, slug, title FROM library_articles"),
  ]);

  const motifs = groupStrings(motifRows as Array<{ owner_id: string; item_name: string }>);
  const styleTechniques = groupReferences(styleTechniqueRows);
  const relatedStyles = groupReferences(relatedStyleRows);
  const usages = groupReferences(usageRows);
  const components = groupReferences(componentRows);

  const articlesByPaper = new Map<string, ArticleRef>(
    articleRefRows.map((row) => [row.article_id, { id: row.article_id, slug: row.slug, title: row.title }]),
  );

  const styles: TattooStyle[] = styleRows.map((row) => {
    const enrichment = parseJson<EntryEnrichment>(row.source_payload, {});
    return {
      id: row.style_id,
      name: row.name,
      categoryId: row.category_id,
      categoryName: row.category_name,
      description: row.description,
      history: row.history,
      distinctFeatures: row.distinct_features,
      narrativeDescription: englishStyleNarrative(row.name, row.category_name, row.description, row.history, row.distinct_features),
      motifs: motifs.get(row.style_id) || [],
      techniques: styleTechniques.get(row.style_id) || [],
      relatedStyles: relatedStyles.get(row.style_id) || [],
      ...entryEnrichment(enrichment, articlesByPaper),
    };
  });

  const techniques: TattooTechnique[] = techniqueRows.map((row) => {
    const enrichment = parseJson<EntryEnrichment>(row.source_payload, {});
    return {
      id: row.technique_id,
      name: row.name,
      categoryId: row.category_id,
      categoryName: row.category_name,
      description: row.description,
      difficulty: row.difficulty,
      narrativeDescription: englishTechniqueNarrative(row.name, row.category_name, row.difficulty, row.description),
      usedInStyles: usages.get(row.technique_id) || [],
      ...entryEnrichment(enrichment, articlesByPaper),
    };
  });

  const mixedStyles: MixedStyle[] = mixedRows.map((row) => ({
    id: String(row.mixed_style_id),
    name: String(row.name),
    description: String(row.description),
    narrativeDescription: String(row.narrative_description),
    components: components.get(String(row.mixed_style_id)) || [],
  }));

  return {
    source: "sql",
    version: String(manifestRows[0]?.source_version || sourceDatabase.meta.version),
    updatedAt: dateValue(manifestRows[0]?.source_date || sourceDatabase.meta.date),
    categories: categoryRows.map(categoryFromRow),
    techniqueCategories: techniqueCategoryRows.map(categoryFromRow),
    styles,
    techniques,
    mixedStyles,
  };
}

function getJsonCompendium(database: JsonDatabase): CompendiumData {
  const styleById = new Map(database.styles.map((item) => [item.id, item]));
  const techniqueById = new Map(database.techniques.map((item) => [item.id, item]));
  const categoryById = new Map(database.styleCategories.map((item) => [item.id, item]));
  const techniqueCategoryById = new Map(database.techniqueCategories.map((item) => [item.id, item]));

  const articlesByPaper = new Map<string, ArticleRef>(
    database.articles.map((article) => [article.id, { id: article.id, slug: article.slug, title: article.title }]),
  );

  const styles: TattooStyle[] = database.styles.map((item) => ({
    id: item.id,
    name: item.name,
    categoryId: item.category,
    categoryName: categoryById.get(item.category)?.name || item.category,
    description: item.description,
    history: item.history,
    distinctFeatures: item.distinctFeatures,
    narrativeDescription: styleNarrative(item, categoryById.get(item.category)?.name || item.category),
    motifs: item.commonMotifs,
    techniques: item.relatedTechniques.map((id) => ({ id, name: techniqueById.get(id)?.name || id })),
    relatedStyles: item.relatedStyles.map((id) => ({ id, name: styleById.get(id)?.name || id })),
    ...entryEnrichment(item, articlesByPaper),
  }));

  const techniques: TattooTechnique[] = database.techniques.map((item) => ({
    id: item.id,
    name: item.name,
    categoryId: item.category,
    categoryName: techniqueCategoryById.get(item.category)?.name || item.category,
    description: item.description,
    difficulty: item.difficulty,
    narrativeDescription: techniqueNarrative(item, techniqueCategoryById.get(item.category)?.name || item.category),
    usedInStyles: item.usedInStyles.map((id) => ({ id, name: styleById.get(id)?.name || id })),
    ...entryEnrichment(item, articlesByPaper),
  }));

  const mixedStyles: MixedStyle[] = database.mixedStyles.examples.map((item) => ({
    id: slug(item.name),
    name: item.name,
    description: database.mixedStyles.description,
    narrativeDescription: `${item.name} combines ${item.combination.map((id) => styleById.get(id)?.name || id).join(" and ")}. Both visual languages should form one composition instead of competing with each other.`,
    components: item.combination.map((id) => ({ id, name: styleById.get(id)?.name || techniqueById.get(id)?.name || id })),
  }));

  return {
    source: "json",
    version: database.meta.version,
    updatedAt: database.meta.date,
    categories: database.styleCategories,
    techniqueCategories: database.techniqueCategories,
    styles,
    techniques,
    mixedStyles,
  };
}

export function buildRelevantContext(data: CompendiumData, text: string): string {
  const terms = normalize(text).split(/\s+/).filter((term) => term.length > 2);
  const score = (haystack: string, name: string) => {
    const normalized = normalize(haystack);
    const normalizedName = normalize(name);
    return terms.reduce((sum, term) => sum + (normalizedName.includes(term) ? 6 : normalized.includes(term) ? 1 : 0), 0);
  };

  const styleMatches = data.styles
    .map((item) => ({ item, score: score(`${item.description} ${item.history} ${item.distinctFeatures} ${item.motifs.join(" ")} ${factText(item.keyFacts)}`, item.name) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ item }) => `STYLE ${item.name}: ${item.description} History: ${item.history} Features: ${item.distinctFeatures} Motifs: ${item.motifs.join(", ")}. Techniques: ${item.techniques.map((technique) => technique.name).join(", ")}.${sourcedFacts(item.keyFacts, item.sourceArticle?.id)}`);

  const techniqueMatches = data.techniques
    .map((item) => ({ item, score: score(`${item.description} ${item.usedInStyles.map((style) => style.name).join(" ")} ${factText(item.keyFacts)}`, item.name) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ item }) => `TECHNIQUE ${item.name} (${item.difficulty}): ${item.description} Used in: ${item.usedInStyles.map((style) => style.name).join(", ")}.${sourcedFacts(item.keyFacts, item.sourceArticle?.id)}`);

  const fusionMatches = data.mixedStyles
    .filter((item) => score(`${item.description} ${item.components.map((part) => part.name).join(" ")}`, item.name) > 0)
    .slice(0, 3)
    .map((item) => `PROVEN FUSION ${item.name}: ${item.components.map((part) => part.name).join(" + ")}.`);

  const matches = [...styleMatches, ...techniqueMatches, ...fusionMatches];
  return matches.length ? matches.join("\n") : "No exact entry matched. Ask one focused question before recommending a style.";
}

function factText(facts: KeyFact[]): string {
  return facts.map((fact) => fact.text).join(" ");
}

/** Renders paper-grounded claims with their evidence label so Alexei can cite honestly. */
function sourcedFacts(facts: KeyFact[], paperId?: string): string {
  if (!facts.length) return "";
  const claims = facts.map((fact) => `${fact.text} [${fact.evidence}]`).join(" ");
  return ` Documented${paperId ? ` in ${paperId}` : ""}: ${claims}`;
}

/** Shared shape for the paper-grounded enrichment carried by every catalog entry. */
function entryEnrichment(
  item: EntryEnrichment,
  articlesByPaper: Map<string, ArticleRef>,
): Pick<TattooStyle, "fieldNote" | "keyFacts" | "sourceArticle"> {
  return {
    fieldNote: item.fieldNote || null,
    keyFacts: (item.keyFacts || []).map((fact) => ({ text: fact.text, evidence: asEvidenceLabel(fact.evidence) })),
    sourceArticle: (item.sourcePaper && articlesByPaper.get(item.sourcePaper)) || null,
  };
}

function categoryFromRow(row: RowDataPacket): Category {
  return { id: String(row.category_id), name: String(row.name), description: String(row.description) };
}

function groupStrings(rows: Array<{ owner_id: string; item_name: string }>): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const row of rows) result.set(row.owner_id, [...(result.get(row.owner_id) || []), row.item_name]);
  return result;
}

function groupReferences(rows: RelationRow[]): Map<string, ReferenceItem[]> {
  const result = new Map<string, ReferenceItem[]>();
  for (const row of rows) {
    result.set(row.owner_id, [...(result.get(row.owner_id) || []), { id: row.item_id, name: row.item_name }]);
  }
  return result;
}

function dateValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function styleNarrative(item: JsonDatabase["styles"][number], category: string): string {
  return englishStyleNarrative(item.name, category, item.description, item.history, item.distinctFeatures);
}

function techniqueNarrative(item: JsonDatabase["techniques"][number], category: string): string {
  return englishTechniqueNarrative(item.name, category, item.difficulty, item.description);
}

function englishStyleNarrative(name: string, category: string, description: string, history: string, features: string): string {
  return `${name} belongs to the ${category} family. ${description} ${history} On skin, it is recognized by these defining traits: ${features}`;
}

function englishTechniqueNarrative(name: string, category: string, difficulty: string, description: string): string {
  return `${name} is a ${difficulty}-level method in the ${category} group. ${description} Its quality depends on deliberate execution, anatomical placement, and enough breathing room for the tattoo to age clearly.`;
}

function slug(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

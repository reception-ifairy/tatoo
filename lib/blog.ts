import fs from "node:fs/promises";
import path from "node:path";
import type { RowDataPacket } from "mysql2";
import sourceDatabase from "@/scripts/database/tattoo_database.backup.json";
import { getDbPool, parseJson } from "@/lib/db";
import type { Article, ArticleModule, ArticleSummary, BlogData, ReferenceItem } from "@/lib/types";

interface ArticleRow extends RowDataPacket {
  article_id: string;
  slug: string;
  module: ArticleModule;
  display_order: number;
  title: string;
  paper_title: string;
  dek: string;
  curator_note: string;
  tags: unknown;
  word_count: number;
  reading_minutes: number;
  published_at: unknown;
  body?: string;
}

interface EntryRow extends RowDataPacket {
  article_id: string;
  catalog_id: string;
  catalog_name: string;
}

const LIBRARY_DIRECTORY = path.join(process.cwd(), "data", "library");
const ARTICLE_COLUMNS =
  "article_id, slug, module, display_order, title, paper_title, dek, curator_note, tags, word_count, reading_minutes, published_at";

/** Every article in the library, newest module order first. Falls back to the JSON mirror. */
export async function getBlog(): Promise<BlogData> {
  try {
    const [rows] = await getDbPool().query<ArticleRow[]>(
      `SELECT ${ARTICLE_COLUMNS} FROM library_articles ORDER BY display_order`,
    );
    if (!rows.length) throw new Error("library_articles is empty");
    const entries = await getEntryMap();
    return { source: "sql", articles: rows.map((row) => summaryFromRow(row, entries.get(row.article_id) || [])) };
  } catch (error) {
    console.warn("[InkTelligence] SQL library unavailable; using the JSON mirror.", error instanceof Error ? error.message : error);
    return { source: "json", articles: jsonSummaries() };
  }
}

/** One article with its paper body, or null when the slug is unknown. */
export async function getArticle(slug: string): Promise<Article | null> {
  try {
    const [rows] = await getDbPool().query<ArticleRow[]>(
      `SELECT ${ARTICLE_COLUMNS}, body FROM library_articles WHERE slug = ? LIMIT 1`,
      [slug],
    );
    const row = rows[0];
    if (!row) return jsonArticle(slug);
    if (!row.body) throw new Error(`library_articles.body is empty for ${slug}`);
    const entries = (await getEntryMap()).get(row.article_id) || [];
    return { ...summaryFromRow(row, entries.map((entry) => entry.id)), body: row.body, entries };
  } catch (error) {
    console.warn("[InkTelligence] SQL article unavailable; reading the paper from data/library.", error instanceof Error ? error.message : error);
    return jsonArticle(slug);
  }
}

/** Slugs for static generation. */
export async function getArticleSlugs(): Promise<string[]> {
  const { articles } = await getBlog();
  return articles.map((article) => article.slug);
}

async function getEntryMap(): Promise<Map<string, ReferenceItem[]>> {
  const [rows] = await getDbPool().query<EntryRow[]>(`SELECT e.article_id, e.catalog_id, COALESCE(s.name, t.name, e.catalog_id) AS catalog_name
    FROM library_article_entries AS e
    LEFT JOIN styles AS s ON s.style_id = e.catalog_id
    LEFT JOIN techniques AS t ON t.technique_id = e.catalog_id
    ORDER BY e.article_id, e.display_order`);
  const map = new Map<string, ReferenceItem[]>();
  for (const row of rows) {
    map.set(row.article_id, [...(map.get(row.article_id) || []), { id: row.catalog_id, name: row.catalog_name }]);
  }
  return map;
}

function summaryFromRow(row: ArticleRow, catalogIds: ReferenceItem[] | string[]): ArticleSummary {
  return {
    id: row.article_id,
    slug: row.slug,
    module: row.module,
    order: row.display_order,
    title: row.title,
    paperTitle: row.paper_title,
    dek: row.dek,
    curatorNote: row.curator_note,
    tags: parseJson<string[]>(row.tags, []),
    wordCount: row.word_count,
    readingMinutes: row.reading_minutes,
    publishedAt: dateValue(row.published_at),
    catalogIds: catalogIds.map((entry) => (typeof entry === "string" ? entry : entry.id)),
  };
}

type JsonArticle = (typeof sourceDatabase.articles)[number];

/** The mirrored record carries an internal file name the public shape omits. */
function toSummary(record: JsonArticle): ArticleSummary {
  return {
    id: record.id,
    slug: record.slug,
    module: record.module as ArticleModule,
    order: record.order,
    title: record.title,
    paperTitle: record.paperTitle,
    dek: record.dek,
    curatorNote: record.curatorNote,
    tags: record.tags,
    wordCount: record.wordCount,
    readingMinutes: record.readingMinutes,
    publishedAt: record.publishedAt,
    catalogIds: record.catalogIds,
  };
}

function jsonSummaries(): ArticleSummary[] {
  return [...sourceDatabase.articles].sort((a, b) => a.order - b.order).map(toSummary);
}

async function jsonArticle(slug: string): Promise<Article | null> {
  const record = sourceDatabase.articles.find((article) => article.slug === slug);
  if (!record) return null;
  const body = await fs.readFile(path.join(LIBRARY_DIRECTORY, record.file), "utf8");
  return {
    ...toSummary(record),
    body,
    entries: record.catalogIds.map((id) => ({ id, name: catalogName(id) })),
  };
}

function catalogName(id: string): string {
  return (
    sourceDatabase.styles.find((style) => style.id === id)?.name ||
    sourceDatabase.techniques.find((technique) => technique.id === id)?.name ||
    id
  );
}

function dateValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

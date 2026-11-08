import fs from 'fs';
import path from 'path';
import type { Article, Compendium, TattooStyle, TattooTechnique } from '../src/compendium';

// Loads the compendium and the library once. Everything here is read-only content shipped with the app.

let cached: Compendium | null = null;
let root = process.cwd();

export function initCompendium(appDir: string) {
  root = appDir;
  cached = JSON.parse(fs.readFileSync(path.join(appDir, 'content', 'compendium.json'), 'utf8')) as Compendium;
}

export function compendium(): Compendium {
  if (!cached) initCompendium(root);
  return cached!;
}

export function styleById(id: string): TattooStyle | undefined {
  return compendium().styles.find((s) => s.id === id);
}

export function techniqueById(id: string): TattooTechnique | undefined {
  return compendium().techniques.find((t) => t.id === id);
}

/** Finds a style by id or by name as the assistant writes it ("Japanese Irezumi", "fine-line"). */
export function matchStyle(text: string | null | undefined): TattooStyle | undefined {
  if (!text) return undefined;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const t = norm(text);
  const all = compendium().styles;
  return (
    all.find((s) => norm(s.id) === t || norm(s.name) === t) ??
    all.find((s) => t.includes(norm(s.name)) || norm(s.name).includes(t)) ??
    all.find((s) => norm(s.id.replace(/_style$/, '')) === t)
  );
}

export function articleBySlug(slug: string): { article: Article; body: string } | null {
  const article = compendium().articles.find((a) => a.slug === slug);
  if (!article || !/^[a-z0-9-]+\.md$/.test(article.file)) return null;
  try {
    return { article, body: fs.readFileSync(path.join(root, 'content', 'library', article.file), 'utf8') };
  } catch {
    return null;
  }
}

/** One line per style: the assistant's map of the catalogue, always in its context. */
export function styleIndex(): string {
  const c = compendium();
  return c.styleCategories
    .map((cat) => `- ${cat.name}: ${c.styles.filter((s) => s.category === cat.id).map((s) => s.name).join(', ')}`)
    .join('\n');
}

export function techniqueIndex(): string {
  const c = compendium();
  return c.techniqueCategories
    .map((cat) => `- ${cat.name}: ${c.techniques.filter((t) => t.category === cat.id).map((t) => t.name).join(', ')}`)
    .join('\n');
}

/** Full entries for styles and techniques the conversation mentions (simple name match, at most 6). */
export function relevantEntries(text: string): string {
  const lower = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  const has = (name: string) => {
    const n = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return n.length > 3 && lower.includes(` ${n} `);
  };
  const c = compendium();
  const styles = c.styles.filter((s) => has(s.name) || has(s.id.replace(/_/g, ' '))).slice(0, 4);
  const techniques = c.techniques.filter((t) => has(t.name)).slice(0, 3);
  const blocks = [
    ...styles.map(
      (s) =>
        `STYLE ${s.name} (${s.id}, category ${s.category})\n${s.description}\nHistory: ${s.history}\nFeatures: ${s.distinctFeatures}\nMotifs: ${s.commonMotifs.join(', ')}\nField note: ${s.fieldNote}\nFacts:\n${s.keyFacts.map((f) => `  · [${f.evidence}] ${f.text}`).join('\n')}`,
    ),
    ...techniques.map(
      (t) =>
        `TECHNIQUE ${t.name} (${t.id}, ${t.difficulty})\n${t.description}\nUsed in: ${t.usedInStyles.join(', ')}\nField note: ${t.fieldNote}\nFacts:\n${t.keyFacts.map((f) => `  · [${f.evidence}] ${f.text}`).join('\n')}`,
    ),
  ];
  return blocks.join('\n\n');
}

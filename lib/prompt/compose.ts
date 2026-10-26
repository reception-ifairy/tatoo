import { getAlexeiRuntime } from "@/lib/alexei";
import { getCompendium } from "@/lib/compendium";
import type { CompendiumData, TattooStyle, TattooTechnique } from "@/lib/types";
import type { DesignSpec, PromptBlock, PromptIR, PromptSlot, RenderMode } from "@/lib/prompt/types";

/** Placement drives framing: the render should be shaped like the body part it will live on. */
const ASPECT_BY_PLACEMENT: Array<[RegExp, string]> = [
  [/sleeve|full arm|full leg/, "9:16"],
  [/forearm|calf|thigh|shin|upper arm|bicep|tricep|spine/, "2:3"],
  [/back|chest|sternum|shoulder blade/, "4:5"],
  [/rib|side|hip|stomach|abdomen/, "3:4"],
  [/hand|finger|knuckle|wrist|ankle|foot|neck|throat|behind the ear|collarbone/, "1:1"],
];

/** Places where a fine line closes up or spreads fastest. */
const HIGH_MOVEMENT = /hand|finger|knuckle|elbow|knee|wrist|ankle|foot|neck/;

interface KnowledgeLeaf {
  key: string;
  renderTags: string[];
}

/**
 * Resolves a design spec against the live compendium and knowledge base into one
 * model-independent representation. Every generator renders from this, so a change of
 * target never changes what the design actually says.
 */
export async function composePromptIR(spec: DesignSpec, blocks: PromptBlock[]): Promise<PromptIR> {
  const [compendium, runtime] = await Promise.all([getCompendium(), getAlexeiRuntime()]);
  const warnings: string[] = [];
  const renderMode = spec.renderMode;

  const styleNames = [spec.style, spec.secondaryStyle].filter((value): value is string => Boolean(value));
  const styleMatches = styleNames.map((name) => ({ name, match: findStyle(compendium, name) }));
  for (const entry of styleMatches) {
    if (!entry.match) warnings.push(`No compendium entry matched the style "${entry.name}"; it is used as literal prompt text.`);
  }

  const knowledgeLeaves = flattenRenderTags(runtime.knowledgeBase);
  const renderTags = unique(styleNames.flatMap((name) => renderTagsFor(name, knowledgeLeaves)));

  const techniqueMatches = spec.technique ? findTechniques(compendium, spec.technique) : [];
  const styleEntries = styleMatches.map((entry) => entry.match).filter((value): value is TattooStyle => Boolean(value));

  const aspectRatio = aspectFor(spec.placement);
  const usedBlocks: PromptBlock[] = [];
  const pick = (type: PromptBlock["blockType"]) => {
    const found = selectBlocks(blocks, type, renderMode);
    usedBlocks.push(...found);
    return found.map((block) => block.content);
  };

  const surface = pick("surface").join(", ");
  const detailParts = pick("quality");
  const lighting = renderMode === "on_skin" ? pick("lighting").join(", ") : "";

  if (spec.lineWeight === "fine" && spec.placement && HIGH_MOVEMENT.test(normalize(spec.placement))) {
    warnings.push(`Fine linework on ${spec.placement} spreads and closes up as it ages; the prompt asks for thickened key outlines.`);
    detailParts.push(...pick("longevity"));
  }

  if (spec.culturalCheck === "inspired_not_copied") {
    detailParts.push(...pick("cultural"));
  }

  const negatives = selectBlocks(blocks, "negative", renderMode);
  usedBlocks.push(...negatives);

  const slots: Record<PromptSlot, string> = {
    subject: spec.subject,
    style: styleNames.join(" fused with "),
    technique: techniqueClause(spec.technique, techniqueMatches),
    palette: spec.palette?.trim() || "black and grey, using bare skin as negative space",
    composition: compositionClause(spec, styleEntries),
    surface: surface,
    lighting,
    detail: unique(detailParts).join(", "),
    placement: spec.placement?.trim() || "the chosen placement",
  };

  return {
    renderMode,
    culturalCheck: spec.culturalCheck,
    slots,
    tagBoost: buildTagBoost(spec.subject, renderTags, styleEntries),
    negatives: unique(negatives.flatMap((block) => block.content.split(",").map((part) => part.trim()))).filter(Boolean),
    aspectRatio,
    catalogRefs: {
      styleIds: styleEntries.map((style) => style.id),
      techniqueIds: techniqueMatches.map((technique) => technique.id),
      renderTags,
      blockIds: unique(usedBlocks.map((block) => block.blockId)),
      compendiumSource: compendium.source,
    },
    warnings,
  };
}

/**
 * Style vocabulary is inherited, subject matter is not. A style's motifs are concrete things
 * — a koi, a hannya mask — and pasting them into the prompt makes the generator draw objects
 * the client never asked for, so a motif only survives if the subject already names it.
 */
function buildTagBoost(subject: string, renderTags: string[], entries: TattooStyle[]): string[] {
  const motifs = new Set(entries.flatMap((style) => style.motifs).map(normalize));
  const normalizedSubject = normalize(subject);
  const candidates = unique([...renderTags, ...entries.flatMap((style) => style.motifs)]);
  return candidates.filter((tag) => {
    const normalized = normalize(tag);
    return !motifs.has(normalized) || normalizedSubject.includes(normalized);
  });
}

/** The spec's own wording leads; matched catalog techniques only fill what it left out. */
function techniqueClause(raw: string | undefined, matches: TattooTechnique[]): string {
  const spoken = (raw || "").split(",").map((part) => part.trim()).filter(Boolean);
  const known = new Set(spoken.map((part) => normalize(part)));
  const added = matches
    .map((technique) => technique.name.toLowerCase())
    .filter((name) => !known.has(normalize(name)));
  return unique([...spoken, ...added]).join(", ") || "clean linework with controlled shading";
}

function compositionClause(spec: DesignSpec, entries: TattooStyle[]): string {
  const parts = [spec.composition?.trim()].filter((value): value is string => Boolean(value));
  if (spec.placement) parts.push(`flowing along ${spec.placement}, following its natural line`);
  if (spec.size) parts.push(`approximately ${spec.size}`);
  if (!parts.length && entries[0]) parts.push(`composed the way ${entries[0].name} usually sits on the body`);
  return parts.join(", ");
}

function selectBlocks(blocks: PromptBlock[], type: PromptBlock["blockType"], mode: RenderMode): PromptBlock[] {
  return blocks
    .filter((block) => block.blockType === type && (block.renderMode === mode || block.renderMode === "both"))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

function aspectFor(placement: string | undefined): string {
  if (!placement) return "1:1";
  const normalized = normalize(placement);
  for (const [pattern, ratio] of ASPECT_BY_PLACEMENT) {
    if (pattern.test(normalized)) return ratio;
  }
  return "1:1";
}

function findStyle(compendium: CompendiumData, name: string): TattooStyle | undefined {
  const normalized = normalize(name);
  return (
    compendium.styles.find((style) => normalize(style.name) === normalized) ||
    compendium.styles.find((style) => normalized.includes(normalize(style.name)) || normalize(style.name).includes(normalized))
  );
}

function findTechniques(compendium: CompendiumData, raw: string): TattooTechnique[] {
  const normalized = normalize(raw);
  return compendium.techniques.filter((technique) => normalized.includes(normalize(technique.name))).slice(0, 4);
}

/** The knowledge base carries prompt-ready `render_tags` per style; flatten them once. */
function flattenRenderTags(knowledgeBase: Record<string, unknown>): KnowledgeLeaf[] {
  const styles = (knowledgeBase.styles || {}) as Record<string, Record<string, { render_tags?: string[] }>>;
  const leaves: KnowledgeLeaf[] = [];
  for (const family of Object.values(styles)) {
    if (!family || typeof family !== "object") continue;
    for (const [key, leaf] of Object.entries(family)) {
      if (leaf?.render_tags?.length) leaves.push({ key: key.replaceAll("_", " "), renderTags: leaf.render_tags });
    }
  }
  return leaves;
}

function renderTagsFor(name: string, leaves: KnowledgeLeaf[]): string[] {
  const normalized = normalize(name);
  const leaf = leaves.find((entry) => normalized.includes(entry.key) || entry.key.includes(normalized));
  return leaf?.renderTags || [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

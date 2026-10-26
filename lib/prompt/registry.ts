import type { RowDataPacket } from "mysql2";
import { getDbPool, parseJson } from "@/lib/db";
import type { ImageModel, ModelCapabilities, ModelSyntaxProfile, PromptBlock, PromptRegistry } from "@/lib/prompt/types";

interface ModelRow extends RowDataPacket {
  model_key: string;
  family: string;
  vendor: string;
  display_name: string;
  model_version: string;
  status: ImageModel["status"];
  syntax_profile: unknown;
  capabilities: unknown;
  default_parameters: unknown;
  notes: string;
  is_default: number;
}

interface BlockRow extends RowDataPacket {
  block_id: string;
  block_type: PromptBlock["blockType"];
  render_mode: PromptBlock["renderMode"];
  applies_to_family: string;
  content: string;
  weight: string | number | null;
  display_order: number;
}

/**
 * The registry is the future-proofing seam: a new generator is a row in `image_models`,
 * never a new branch in the renderer. SQL is the source of truth; the embedded profile
 * below only keeps prompt building alive when the database is unreachable.
 */
export async function getPromptRegistry(): Promise<PromptRegistry> {
  try {
    const pool = getDbPool();
    const [[modelRows], [blockRows]] = await Promise.all([
      pool.query<ModelRow[]>("SELECT * FROM v_image_model_registry"),
      pool.query<BlockRow[]>("SELECT * FROM prompt_blocks WHERE is_active = TRUE ORDER BY block_type, display_order"),
    ]);
    if (!modelRows.length) throw new Error("Image model registry is empty");
    return { models: modelRows.map(modelFromRow), blocks: blockRows.map(blockFromRow), source: "sql" };
  } catch (error) {
    console.warn("[InkTelligence] Image model registry unavailable; using the built-in SDXL profile.", error instanceof Error ? error.message : error);
    return { models: [FALLBACK_MODEL], blocks: FALLBACK_BLOCKS, source: "json" };
  }
}

function modelFromRow(row: ModelRow): ImageModel {
  return {
    modelKey: row.model_key,
    family: row.family,
    vendor: row.vendor,
    displayName: row.display_name,
    modelVersion: row.model_version,
    status: row.status,
    isDefault: Boolean(row.is_default),
    notes: row.notes,
    syntax: normalizeSyntax(parseJson<Record<string, unknown>>(row.syntax_profile, {})),
    capabilities: normalizeCapabilities(parseJson<Record<string, unknown>>(row.capabilities, {})),
    defaultParameters: parseJson<Record<string, unknown>>(row.default_parameters, {}),
  };
}

function blockFromRow(row: BlockRow): PromptBlock {
  return {
    blockId: row.block_id,
    blockType: row.block_type,
    renderMode: row.render_mode,
    appliesToFamily: row.applies_to_family,
    content: row.content,
    weight: row.weight === null ? null : Number(row.weight),
    displayOrder: row.display_order,
  };
}

/** Registry rows are hand-authored JSON, so every field is defaulted rather than trusted. */
function normalizeSyntax(raw: Record<string, unknown>): ModelSyntaxProfile {
  const profile = raw as Partial<ModelSyntaxProfile> & { slot_order?: ModelSyntaxProfile["slotOrder"]; style_suffix?: string };
  return {
    form: profile.form || "tags",
    joiner: profile.joiner || ", ",
    slotOrder: profile.slot_order || profile.slotOrder || ["subject", "style", "technique", "palette", "composition", "surface", "lighting", "detail"],
    styleSuffix: profile.style_suffix || profile.styleSuffix,
    weights: profile.weights || { syntax: "none" },
    negative: profile.negative || { mode: "none" },
    parameters: profile.parameters || { mode: "none" },
    aspect: profile.aspect || { mode: "none" },
    templates: profile.templates,
  };
}

function normalizeCapabilities(raw: Record<string, unknown>): ModelCapabilities {
  const flag = (key: string) => Boolean(raw[key]);
  return {
    supportsNegativePrompt: flag("supports_negative_prompt"),
    supportsWeights: flag("supports_weights"),
    supportsParameters: flag("supports_parameters"),
    supportsConversationalEdit: flag("supports_conversational_edit"),
    supportsReferenceImage: flag("supports_reference_image"),
    maxPromptChars: Number(raw.max_prompt_chars) || 1500,
  };
}

const FALLBACK_MODEL: ImageModel = {
  modelKey: "sdxl_base",
  family: "stable_diffusion",
  vendor: "Stability AI",
  displayName: "Stable Diffusion XL",
  modelVersion: "1.0",
  status: "active",
  isDefault: true,
  notes: "Built-in fallback profile used only while the registry table is unreachable.",
  syntax: {
    form: "tags",
    joiner: ", ",
    slotOrder: ["subject", "style", "technique", "palette", "composition", "surface", "lighting", "detail"],
    weights: { syntax: "sd_parens", emphasis: 1.2, slots: ["style", "technique"] },
    negative: { mode: "field", joiner: ", " },
    parameters: { mode: "fields" },
    aspect: { mode: "dimensions", base: 1024 },
  },
  capabilities: {
    supportsNegativePrompt: true,
    supportsWeights: true,
    supportsParameters: true,
    supportsConversationalEdit: false,
    supportsReferenceImage: true,
    maxPromptChars: 1500,
  },
  defaultParameters: { steps: 34, cfg_scale: 6, sampler: "DPM++ 2M Karras", clip_skip: 2 },
};

const FALLBACK_BLOCKS: PromptBlock[] = [
  { blockId: "surface_flash", blockType: "surface", renderMode: "flash", appliesToFamily: "all", weight: 1.2, displayOrder: 10, content: "isolated on a clean white background, tattoo flash sheet, centered, illustration only, not a photograph" },
  { blockId: "surface_on_skin", blockType: "surface", renderMode: "on_skin", appliesToFamily: "all", weight: 1.2, displayOrder: 10, content: "real healed ink on natural skin with visible pores and texture" },
  { blockId: "quality_flash", blockType: "quality", renderMode: "flash", appliesToFamily: "all", weight: 1.2, displayOrder: 20, content: "crisp confident linework, high detail, sharp focus" },
  { blockId: "quality_on_skin", blockType: "quality", renderMode: "on_skin", appliesToFamily: "all", weight: null, displayOrder: 20, content: "high detail, natural color, shallow depth of field" },
  { blockId: "lighting_studio", blockType: "lighting", renderMode: "on_skin", appliesToFamily: "all", weight: null, displayOrder: 30, content: "soft directional studio lighting" },
  { blockId: "negative_flash", blockType: "negative", renderMode: "flash", appliesToFamily: "all", weight: null, displayOrder: 10, content: "blurry, muddy lines, color bleed, washed out, watermark, signature, text, jpeg artifacts, photographic background, skin, deformed anatomy, extra limbs" },
  { blockId: "negative_on_skin", blockType: "negative", renderMode: "on_skin", appliesToFamily: "all", weight: null, displayOrder: 10, content: "flat sticker look, plastic skin, blurry, color bleed, watermark, signature, text, deformed anatomy, extra limbs, unhealed wound" },
];

import { z } from "zod";
import type { DataSource } from "@/lib/types";

/** Where the design lives: a tattooable stencil, or a preview of it on skin. */
export type RenderMode = "flash" | "on_skin";

export type CulturalCheck = "clear" | "inspired_not_copied" | "flagged";

/** The Phase 5 artifact Alexei emits. Everything downstream is built from this. */
export const designSpecSchema = z.object({
  subject: z.string().trim().min(3).max(400),
  narrativeIntent: z.string().trim().max(300).optional(),
  style: z.string().trim().min(2).max(200),
  secondaryStyle: z.string().trim().max(200).optional(),
  technique: z.string().trim().max(300).optional(),
  palette: z.string().trim().max(300).optional(),
  composition: z.string().trim().max(400).optional(),
  placement: z.string().trim().max(160).optional(),
  size: z.string().trim().max(80).optional(),
  lineWeight: z.enum(["fine", "medium", "bold"]).optional(),
  mood: z.string().trim().max(160).optional(),
  culturalCheck: z.enum(["clear", "inspired_not_copied", "flagged"]).default("clear"),
  renderMode: z.enum(["flash", "on_skin"]).default("flash"),
});

export type DesignSpec = z.infer<typeof designSpecSchema>;

/** Named prompt slots. Tag models assemble them in order; prose models fill them into templates. */
export type PromptSlot =
  | "subject"
  | "style"
  | "technique"
  | "palette"
  | "composition"
  | "surface"
  | "lighting"
  | "detail"
  | "placement";

/**
 * Model-independent intermediate representation. Composition resolves the spec against the
 * compendium once; every generator renders from this, so targets never diverge in meaning.
 */
export interface PromptIR {
  renderMode: RenderMode;
  culturalCheck: CulturalCheck;
  slots: Record<PromptSlot, string>;
  /** Catalog render tags and motifs. Tag dialects inline them; prose dialects get one sentence. */
  tagBoost: string[];
  negatives: string[];
  aspectRatio: string;
  catalogRefs: CatalogRefs;
  warnings: string[];
}

/** What the composer actually matched in the database, kept for provenance. */
export interface CatalogRefs {
  styleIds: string[];
  techniqueIds: string[];
  renderTags: string[];
  blockIds: string[];
  compendiumSource: DataSource;
}

export interface ModelSyntaxProfile {
  form: "tags" | "prose" | "hybrid";
  joiner: string;
  slotOrder: PromptSlot[];
  /** Appended to the style slot by tag dialects, where "<style> tattoo" reads as one tag. */
  styleSuffix?: string;
  weights: { syntax: "sd_parens" | "none"; emphasis?: number; slots?: PromptSlot[] };
  negative: { mode: "field" | "flag" | "prose" | "none"; flag?: string; joiner?: string };
  parameters: { mode: "fields" | "flags" | "none"; flags?: Record<string, string> };
  aspect: { mode: "ratio" | "dimensions" | "sentence" | "none"; base?: number };
  templates?: Partial<Record<RenderMode, string>>;
}

export interface ModelCapabilities {
  supportsNegativePrompt: boolean;
  supportsWeights: boolean;
  supportsParameters: boolean;
  supportsConversationalEdit: boolean;
  supportsReferenceImage: boolean;
  maxPromptChars: number;
}

export interface ImageModel {
  modelKey: string;
  family: string;
  vendor: string;
  displayName: string;
  modelVersion: string;
  status: "active" | "preview" | "deprecated";
  isDefault: boolean;
  notes: string;
  syntax: ModelSyntaxProfile;
  capabilities: ModelCapabilities;
  defaultParameters: Record<string, unknown>;
}

/** A reusable prompt fragment stored in `prompt_blocks`. */
export interface PromptBlock {
  blockId: string;
  blockType: "surface" | "quality" | "lighting" | "longevity" | "cultural" | "negative";
  renderMode: RenderMode | "both";
  appliesToFamily: string;
  content: string;
  weight: number | null;
  displayOrder: number;
}

export interface PromptRegistry {
  models: ImageModel[];
  blocks: PromptBlock[];
  source: DataSource;
}

export interface RenderedPrompt {
  modelKey: string;
  modelName: string;
  family: string;
  prompt: string;
  negativePrompt: string | null;
  parameters: Record<string, unknown>;
  charCount: number;
  truncated: boolean;
  followUpHint: string | null;
}

export interface PromptBuild {
  buildId: string;
  sessionId: string | null;
  spec: DesignSpec;
  ir: PromptIR;
  renders: RenderedPrompt[];
  persisted: boolean;
  registrySource: DataSource;
}

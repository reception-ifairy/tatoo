import type { ImageModel, PromptIR, PromptSlot, RenderedPrompt } from "@/lib/prompt/types";

/**
 * Renders one IR into one model's dialect. There is deliberately no per-model branch here:
 * everything specific lives in the model's `syntax_profile` row, so a new generator is a
 * database insert rather than a new adapter.
 */
export function renderPrompt(ir: PromptIR, model: ImageModel): RenderedPrompt {
  const body = model.syntax.form === "prose" ? renderProse(ir, model) : renderTags(ir, model);
  const parameters = buildParameters(ir, model);

  let prompt = body;
  if (model.syntax.negative.mode === "flag" && ir.negatives.length) {
    prompt += ` ${model.syntax.negative.flag || "--no"} ${ir.negatives.join(model.syntax.negative.joiner || ", ")}`;
  }
  if (model.syntax.parameters.mode === "flags") {
    prompt += ` ${flagString(parameters, model)}`;
  }
  if (model.syntax.aspect.mode === "sentence") {
    prompt += ` Frame it as a ${ir.aspectRatio} image.`;
  }

  prompt = prompt.replace(/\s+/g, " ").trim();
  const limit = model.capabilities.maxPromptChars;
  const truncated = prompt.length > limit;
  if (truncated) prompt = `${prompt.slice(0, limit - 1).trimEnd()}…`;

  return {
    modelKey: model.modelKey,
    modelName: model.displayName,
    family: model.family,
    prompt,
    negativePrompt: model.syntax.negative.mode === "field" && ir.negatives.length
      ? ir.negatives.join(model.syntax.negative.joiner || ", ")
      : null,
    parameters: model.syntax.parameters.mode === "flags" ? {} : parameters,
    charCount: prompt.length,
    truncated,
    followUpHint: model.capabilities.supportsConversationalEdit ? followUpHint(ir) : null,
  };
}

/** Tag dialects: ordered slots, joined, with emphasis applied to the slots the model weights. */
function renderTags(ir: PromptIR, model: ImageModel): string {
  const { weights } = model.syntax;
  const emphasised = new Set(weights.slots || []);
  const seen = new Set<string>();
  const segments: string[] = [];

  for (const slot of model.syntax.slotOrder) {
    const value = ir.slots[slot];
    if (!value) continue;
    const raw = slot === "style" ? [`${value}${model.syntax.styleSuffix || ""}`, ...ir.tagBoost] : value.split(",");
    // The same term can arrive from the spec, the catalog render tags, and a prompt block.
    const parts = raw
      .map((part) => part.trim())
      .filter((part) => {
        const key = part.toLowerCase();
        if (!part || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    if (!parts.length) continue;

    const joined = parts.join(", ");
    segments.push(weights.syntax === "sd_parens" && emphasised.has(slot)
      ? `(${joined}:${(weights.emphasis || 1.2).toFixed(1)})`
      : joined);
  }

  return segments.join(model.syntax.joiner);
}

/** Prose dialects: fill the model's own sentence template, falling back to tag assembly. */
function renderProse(ir: PromptIR, model: ImageModel): string {
  const template = model.syntax.templates?.[ir.renderMode];
  if (!template) return renderTags(ir, model);
  const filled = template.replace(/\{\{(\w+)\}\}/g, (_match, slot: string) => ir.slots[slot as PromptSlot] || "");
  const vocabulary = ir.tagBoost.length ? ` Draw on the visual vocabulary of ${ir.tagBoost.slice(0, 6).join(", ")}.` : "";
  return sentenceCase(tidyProse(`${filled}${vocabulary}`));
}

/** An unfilled slot leaves its punctuation behind — "{{lighting}}." becomes a stray full stop. */
function tidyProse(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .replace(/(?:\.\s*){2,}/g, ". ")
    .replace(/,\s*\./g, ".")
    .trim();
}

function sentenceCase(text: string): string {
  return text.replace(/(^|[.!?]\s+)([a-z])/g, (_match, prefix: string, letter: string) => prefix + letter.toUpperCase());
}

function buildParameters(ir: PromptIR, model: ImageModel): Record<string, unknown> {
  if (model.syntax.parameters.mode === "none") return {};
  const parameters: Record<string, unknown> = { ...model.defaultParameters };

  if (model.syntax.aspect.mode === "ratio") {
    parameters.aspect = ir.aspectRatio;
  } else if (model.syntax.aspect.mode === "dimensions") {
    const [width, height] = dimensionsFor(ir.aspectRatio, model.syntax.aspect.base || 1024);
    parameters.width = width;
    parameters.height = height;
  }
  return parameters;
}

/** Longest side stays at the model's native base, rounded to the multiple of 64 samplers expect. */
function dimensionsFor(ratio: string, base: number): [number, number] {
  const [rawWidth, rawHeight] = ratio.split(":").map(Number);
  if (!rawWidth || !rawHeight) return [base, base];
  const scale = base / Math.max(rawWidth, rawHeight);
  const round = (value: number) => Math.max(512, Math.round((value * scale) / 64) * 64);
  return [round(rawWidth), round(rawHeight)];
}

function flagString(parameters: Record<string, unknown>, model: ImageModel): string {
  const flags = model.syntax.parameters.flags || {};
  return Object.entries(parameters)
    .map(([key, value]) => {
      const flag = flags[key];
      return flag ? `${flag} ${value}` : "";
    })
    .filter(Boolean)
    .join(" ");
}

/** Conversational models keep the subject between turns, so the next step is a sentence, not a re-prompt. */
function followUpHint(ir: PromptIR): string {
  return ir.renderMode === "flash"
    ? "Keep this exact design, then ask: \"Now show it on skin as a realistic studio photo, following the muscle.\""
    : "Keep this exact tattoo, then ask: \"Show the same design as clean flash art on white, and thicken the key outlines.\"";
}

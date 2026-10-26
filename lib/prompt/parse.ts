import { designSpecSchema, type DesignSpec } from "@/lib/prompt/types";

const BLOCK_PATTERN = /```design_spec\s*\n([\s\S]*?)```/i;

/** `line_weight:` in the transcript, `lineWeight` in the schema. */
function camelCase(key: string): string {
  return key.trim().toLowerCase().replace(/[_\s]+(\w)/g, (_match, letter: string) => letter.toUpperCase());
}

/**
 * Alexei writes these fields as prose — "fine, with a slightly thickened stem for aging",
 * "inspired-not-copied (Irezumi is widely practiced…)" — so the enum is read out of the
 * sentence instead of being demanded of him.
 */
const ENUM_FIELDS: Record<string, Array<[RegExp, string]>> = {
  lineWeight: [[/\bfine\b|single.?needle/i, "fine"], [/\bbold\b|heavy/i, "bold"], [/\bmedium\b/i, "medium"]],
  culturalCheck: [[/flag/i, "flagged"], [/inspired/i, "inspired_not_copied"], [/clear|none|n\/a/i, "clear"]],
  renderMode: [[/on.?skin|photo|preview|mockup/i, "on_skin"], [/flash|stencil|sheet/i, "flash"]],
};

function coerceEnum(field: string, value: string): string | undefined {
  for (const [pattern, result] of ENUM_FIELDS[field]) {
    if (pattern.test(value)) return result;
  }
  return undefined;
}

/**
 * Lifts the Phase 5 `design_spec` block out of Alexei's reply so a consultation turn can
 * flow straight into a build. A malformed or absent block is not an error — most turns are
 * ordinary conversation and simply carry no spec.
 */
export function parseDesignSpecBlock(text: string): DesignSpec | null {
  const block = BLOCK_PATTERN.exec(text)?.[1];
  if (!block) return null;

  const fields: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    const key = camelCase(line.slice(0, separator));
    const value = line.slice(separator + 1).trim();
    if (!value) continue;
    const coerced = key in ENUM_FIELDS ? coerceEnum(key, value) : value;
    if (coerced) fields[key] = coerced;
  }

  const parsed = designSpecSchema.safeParse(fields);
  return parsed.success ? parsed.data : null;
}

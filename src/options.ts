import { z } from 'zod';
import { TATTOO_HOUSE_RULES } from './tattooOptions';

// Option groups (style, placement, palette…) shown as thumbnails in the option window. Ported from Kuźnia
// inspiracji via the template; here there is one fixed set, the tattoo set, built on the server from the
// compendium (server/tattooSet.ts). Its thumbnails can be made by the super admin with an image model (paid,
// after a cost check); palettes and diagrams are drawn and cost nothing.

/** Lucide icons an option group may use. */
export const GROUP_ICONS = [
  'Palette', 'Landmark', 'Brush', 'Crown', 'Sun', 'Smile', 'SwatchBook', 'Frame', 'Music', 'Camera', 'Shapes', 'Sparkles',
  'Layers', 'Lamp', 'Sofa', 'Shirt', 'Leaf', 'Mountain', 'Building2', 'Gem', 'Type', 'Wand2', 'Flower2', 'Star', 'Feather', 'PenTool',
] as const;

const slug = z.string().regex(/^[a-z0-9_]{1,40}$/);

export const OptionItemSchema = z.object({
  code: slug,
  label: z.string(),
  description: z.string(),
  /** Short English phrase added to the image prompt. */
  prompt: z.string(),
  colors: z.array(z.string()).nullable(),
  sample: z.string().nullable(),
  /** Compendium category (style/technique groups), used to filter long groups. */
  category: z.string().nullable().optional(),
  /** Living or sacred tradition (style group). */
  cultural: z.enum(['closed', 'sensitive']).nullable().optional(),
});

export const OptionGroupSchema = z.object({
  id: slug,
  label: z.string(),
  description: z.string(),
  promptLabel: z.string().nullable(),
  kind: z.enum(['sample', 'palette', 'diagram']),
  tone: z.string(),
  icon: z.enum(GROUP_ICONS),
  /** Subject shown on every thumbnail of this group (overrides the set's motif). */
  motif: z.string().nullable().optional(),
  options: z.array(OptionItemSchema),
});

export const OptionSetSchema = z.object({
  id: z.string(),
  name: z.string(),
  context: z.string(),
  /** Neutral English subject shared by sample pictures, so differences between options are easy to see. */
  motif: z.string(),
  source: z.enum(['starter', 'ai']),
  createdAt: z.string(),
  groups: z.array(OptionGroupSchema),
});

export type OptionItem = z.infer<typeof OptionItemSchema>;
export type OptionGroup = z.infer<typeof OptionGroupSchema>;
export type OptionSet = z.infer<typeof OptionSetSchema>;
export type GroupIcon = (typeof GROUP_ICONS)[number];

/** group id -> option code ("" or missing = none). */
export type OptionPicks = Record<string, string>;

export const STARTER_SET_ID = 'tattoo';

/** GET /api/options */
export interface OptionsState {
  activeId: string;
  sets: OptionSet[];
}

/** POST /api/options/sets/:id/estimate — what making the thumbnails would cost with the sample model. */
export interface SampleEstimate {
  setId: string;
  count: number;
  priceEach: number;
  totalUsd: number;
  model: { id: string; label: string } | null;
  /** Why thumbnails can't be made right now (no key, model disabled…), or null when ready. */
  blocker: string | null;
}

/** The `result` of a thumbnail run. */
export interface SampleRun {
  set: OptionSet;
  made: number;
  failed: number;
  spentUsd: number;
}

export type SampleTarget = { group: string; code: string };

export function withImageRules(prompt: string): string {
  const p = prompt.trim();
  return p.includes(TATTOO_HOUSE_RULES) ? p : `${p} ${TATTOO_HOUSE_RULES}`.trim();
}

/** Options whose thumbnail must be made with an image model (palettes and diagrams are drawn). */
export function missingSamples(set: OptionSet): { group: OptionGroup; option: OptionItem }[] {
  return set.groups.filter((g) => g.kind === 'sample').flatMap((group) => group.options.filter((o) => !o.sample).map((option) => ({ group, option })));
}

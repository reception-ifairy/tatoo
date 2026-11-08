// Image model catalogue, shared by the server (adapters, detection, cost estimates) and the client (Settings).
// Taken from Kuźnia inspiracji (vizai-kuznia: config/forge.php, config/ai.php, the adapters' price tables and
// lang/pl/forge.php engine_notes; prices checked there on 2026-10-14/20). Providers don't publish prices or
// notes through their APIs, so this list is the source of truth for them; key detection only says which of
// these models a key can reach and which image models the provider has that aren't listed here yet.

export type ImageProvider = 'openai' | 'google' | 'replicate' | 'stability';
export type ImageModelGroup = 'fast' | 'quality' | 'top';
export type ImageAspect = '1:1' | '2:3' | '16:9';

export interface ImageModelDef {
  /** Stable id used in settings (never change it once used). */
  id: string;
  provider: ImageProvider;
  /** The provider's own model id. */
  model: string;
  label: string;
  group: ImageModelGroup;
  /** USD per picture; resolution-priced models list one price per size tier. */
  price: number | Record<string, number>;
  speed: string;
  note: string;
  /** How the size is asked for: named aspect ratios, a size tier (Gemini), OpenAI pixel sizes, or custom sizes up to longEdge. */
  sizing:
    | { kind: 'aspect'; aspects: string[] }
    | { kind: 'tier'; tiers: string[]; defaultTier: string }
    | { kind: 'openai'; quality: 'low' | 'medium' | 'high' }
    | { kind: 'openai-custom'; quality: 'low' | 'medium' | 'high'; longEdge: number };
  /** Extra provider input (e.g. FLUX 3 / FLUX 2 Pro resolution names). */
  extra?: Record<string, string | number | boolean>;
  verifiedAt: string;
}

export const IMAGE_GROUPS: { id: ImageModelGroup; label: string; tone: string }[] = [
  { id: 'fast', label: 'Fast and cheap', tone: '#22d3ee' },
  { id: 'quality', label: 'Quality', tone: '#a78bfa' },
  { id: 'top', label: 'Top quality', tone: '#fbbf24' },
];

const FLUX_ASPECTS = ['1:1', '16:9', '3:2', '2:3', '4:5', '5:4', '9:16', '3:4', '4:3'];
const STABILITY_ASPECTS = ['16:9', '1:1', '21:9', '2:3', '3:2', '4:5', '5:4', '9:16', '9:21'];

export const IMAGE_MODELS: ImageModelDef[] = [
  // Fast and cheap
  {
    id: 'flux_schnell', provider: 'replicate', model: 'black-forest-labs/flux-schnell', label: 'FLUX Schnell', group: 'fast',
    price: 0.003, speed: '1–3 s', sizing: { kind: 'aspect', aspects: FLUX_ASPECTS }, verifiedAt: '2026-08-01',
    note: 'The cheapest and near-instant; weaker on detail. The default model for option thumbnails.',
  },
  {
    id: 'sd35_turbo', provider: 'stability', model: 'sd3.5-large-turbo', label: 'SD3.5 Large Turbo', group: 'fast',
    price: 0.04, speed: '3–5 s', sizing: { kind: 'aspect', aspects: STABILITY_ASPECTS }, verifiedAt: '2026-08-01',
    note: 'A very fast sketch with a painterly texture: check an idea and its composition before spending more.',
  },
  {
    id: 'stable_core', provider: 'stability', model: 'stable-image-core', label: 'Stable Image Core', group: 'fast',
    price: 0.03, speed: '3–6 s', sizing: { kind: 'aspect', aspects: STABILITY_ASPECTS }, verifiedAt: '2026-07-23',
    note: 'The cheapest decent trial: a quick, clean picture to see whether the description and options are heading the right way.',
  },
  {
    id: 'flux_pro', provider: 'replicate', model: 'black-forest-labs/flux-1.1-pro', label: 'FLUX 1.1 Pro', group: 'fast',
    price: 0.04, speed: '5–10 s', sizing: { kind: 'aspect', aspects: FLUX_ASPECTS }, verifiedAt: '2026-07-23',
    note: 'Fast realism: photographic light and materials in seconds, about 1.4 MP. Good for realistic mock-ups.',
  },
  // Quality
  {
    id: 'gemini_flash', provider: 'google', model: 'gemini-nano-banana-2.1', label: 'Gemini Flash Image 2.1', group: 'quality',
    price: { '1K': 0.0336, '2K': 0.0504, '4K': 0.113 }, speed: '15–30 s', sizing: { kind: 'tier', tiers: ['1K', '2K', '4K'], defaultTier: '2K' }, verifiedAt: '2026-10-14',
    note: 'The newest Gemini: the best quality for the price and the best at following style and mood options; a good pick for consistent edits; 4K for large prints.',
  },
  {
    id: 'gpt_standard', provider: 'openai', model: 'gpt-image-2', label: 'GPT Image 2', group: 'quality',
    price: 0.053, speed: '20–40 s', sizing: { kind: 'openai', quality: 'medium' }, verifiedAt: '2026-07-23',
    note: 'Reliable, clean illustration that sticks closely to the description, suited to crisp linework and flash; up to 1536 px, crops wider shapes.',
  },
  {
    id: 'gpt25_flare', provider: 'openai', model: 'gpt-image-2.5-flare', label: 'GPT Image 2.5 Flare', group: 'quality',
    price: 0.06, speed: '15–40 s', sizing: { kind: 'openai-custom', quality: 'medium', longEdge: 2048 }, verifiedAt: '2026-10-14',
    note: 'The newest OpenAI, fast: true shapes up to 2048 px (2:3 and 16:9 without cropping), clean composition.',
  },
  {
    id: 'gpt25_sunburst', provider: 'openai', model: 'gpt-image-2.5-sunburst', label: 'GPT Image 2.5 Sunburst', group: 'quality',
    price: 0.06, speed: '30–60 s', sizing: { kind: 'openai-custom', quality: 'medium', longEdge: 2048 }, verifiedAt: '2026-10-14',
    note: 'The most precise OpenAI: fine detail and complex scenes with many elements from the description; slower.',
  },
  {
    id: 'flux3', provider: 'replicate', model: 'black-forest-labs/flux-3-image', label: 'FLUX 3', group: 'quality',
    price: 0.05, speed: '15–30 s', sizing: { kind: 'aspect', aspects: FLUX_ASPECTS }, extra: { resolution: '2k' }, verifiedAt: '2026-10-14',
    note: 'The newest FLUX: photographic realism, camera-like light and texture, 2K. Best for "real photo" previews.',
  },
  {
    id: 'flux2_pro', provider: 'replicate', model: 'black-forest-labs/flux-2-pro', label: 'FLUX 2 Pro', group: 'quality',
    price: 0.045, speed: '10–25 s', sizing: { kind: 'aspect', aspects: FLUX_ASPECTS }, extra: { resolution: '2 MP' }, verifiedAt: '2026-10-14',
    note: 'Realistic materials (wood, metal, fabric, stone) and consistent colour, 2 MP; inexpensive realism.',
  },
  {
    id: 'sd35_large', provider: 'stability', model: 'sd3.5-large', label: 'SD3.5 Large', group: 'quality',
    price: 0.065, speed: '5–10 s', sizing: { kind: 'aspect', aspects: STABILITY_ASPECTS }, verifiedAt: '2026-08-03',
    note: 'Full Stability quality: distinct art styles and textures, good for painterly and graphic options.',
  },
  {
    id: 'stable_ultra', provider: 'stability', model: 'stable-image-ultra', label: 'Stable Image Ultra', group: 'quality',
    price: 0.08, speed: '8–15 s', sizing: { kind: 'aspect', aspects: STABILITY_ASPECTS }, verifiedAt: '2026-07-23',
    note: 'Rich textures (oil, watercolour) and moody light, about 1.5 MP. For pictures that look painted.',
  },
  // Top quality
  {
    id: 'gemini_pro', provider: 'google', model: 'gemini-3-pro-image', label: 'Gemini 3 Pro Image', group: 'top',
    price: { '1K': 0.134, '2K': 0.134, '4K': 0.24 }, speed: '30–60 s', sizing: { kind: 'tier', tiers: ['1K', '2K', '4K'], defaultTier: '2K' }, verifiedAt: '2026-07-23',
    note: 'The highest quality and the most consistent detail, 2K. For the best designs you want to print.',
  },
  {
    id: 'flux_ultra', provider: 'replicate', model: 'black-forest-labs/flux-1.1-pro-ultra', label: 'FLUX 1.1 Pro Ultra', group: 'top',
    price: 0.06, speed: '10–20 s', sizing: { kind: 'aspect', aspects: FLUX_ASPECTS }, verifiedAt: '2026-08-03',
    note: 'High resolution (about 4 MP) in a dozen or so seconds; sharp detail for large-format prints.',
  },
];

export const DEFAULT_IMAGE_MODEL = 'gemini_flash';
export const DEFAULT_SAMPLE_MODEL = 'flux_schnell';
/** Mannequin previews of an existing design and scar cover-ups take a reference picture: OpenAI or Gemini only. */
export const DEFAULT_EDIT_MODEL = 'gemini_flash';

export function getImageModel(id: string): ImageModelDef | undefined {
  return IMAGE_MODELS.find((m) => m.id === id);
}

/** Price of one picture; for size-tiered models the given tier (or the cheapest). */
export function imagePrice(model: ImageModelDef, tier?: string): number {
  if (typeof model.price === 'number') return model.price;
  if (tier && model.price[tier] !== undefined) return model.price[tier];
  return Math.min(...Object.values(model.price));
}

/** "$0.034" — three places under a dollar (prices per picture are cents). */
export function formatUsd(amount: number): string {
  return `$${amount.toFixed(amount < 1 ? 3 : 2)}`;
}

/** Provider image model ids that count as "image models" when a key lists its models (for "new model" detection). */
export function looksLikeImageModel(provider: ImageProvider, id: string): boolean {
  if (IMAGE_MODELS.some((m) => m.provider === provider && m.model === id)) return true;
  if (provider === 'openai') return /^(gpt-image|dall-e)/.test(id);
  if (provider === 'google') return /(image|imagen|nano-banana)/.test(id) && !/(embedding|tts|audio)/.test(id);
  return true;
}

import { culturalLevel } from '../src/compendium';
import { STARTER_SET_ID, type OptionGroup, type OptionSet } from '../src/options';
import { STATIC_GROUPS } from '../src/tattooOptions';
import { compendium } from './compendium';

// The one option set of the app: style and technique from the compendium, then the fixed tattoo groups.
// Built once; thumbnails are filled in from disk by server/options.ts.

/** Techniques that are services or methods rather than looks, so they don't belong in the generator. */
const NOT_A_LOOK = new Set(['cover_up', 'blast_over', 'skin_stitching', 'layering', 'freehand']);

let cached: OptionSet | null = null;

export function tattooSet(): OptionSet {
  if (cached) return cached;
  const c = compendium();
  const catOrder = (cats: { id: string }[], id: string) => cats.findIndex((x) => x.id === id);
  const styles = [...c.styles].sort((a, b) => catOrder(c.styleCategories, a.category) - catOrder(c.styleCategories, b.category));
  const techniques = [...c.techniques]
    .filter((t) => !NOT_A_LOOK.has(t.id))
    .sort((a, b) => catOrder(c.techniqueCategories, a.category) - catOrder(c.techniqueCategories, b.category));

  const style: OptionGroup = {
    id: 'style',
    label: 'Style',
    description: 'The visual language, from the compendium.',
    promptLabel: null,
    kind: 'sample',
    tone: '#a78bfa',
    icon: 'Feather',
    motif: 'a tattoo flash design of a swallow and a rose, isolated on plain paper',
    options: styles.map((s) => ({
      code: s.id,
      label: s.name,
      description: s.description,
      prompt: `${s.name} tattoo style (${s.distinctFeatures.replace(/\.+$/, '')})`,
      colors: null,
      sample: null,
      category: s.category,
      cultural: culturalLevel(s.id),
    })),
  };
  const technique: OptionGroup = {
    id: 'technique',
    label: 'Technique',
    description: 'How lines, shading and colour are laid in.',
    promptLabel: 'Technique',
    kind: 'sample',
    tone: '#22d3ee',
    icon: 'PenTool',
    motif: 'a tattoo flash design of a single peony flower, isolated on plain paper',
    options: techniques.map((t) => ({
      code: t.id,
      label: t.name,
      description: t.description,
      prompt: `${t.name.toLowerCase()} (${t.description.replace(/\.+$/, '')})`,
      colors: null,
      sample: null,
      category: t.category,
      cultural: null,
    })),
  };
  const mood = STATIC_GROUPS.find((g) => g.id === 'mood')!;
  cached = {
    id: STARTER_SET_ID,
    name: 'Tattoo design',
    context: 'Tattoo design options built from the compendium.',
    motif: 'a tattoo flash design of a wolf head, isolated on plain paper',
    source: 'starter',
    createdAt: c.meta.date,
    groups: [style, technique, ...STATIC_GROUPS.filter((g) => g.id !== 'mood'), { ...mood, motif: 'a tattoo flash design of a wolf head, isolated on plain paper' }],
  };
  return cached;
}

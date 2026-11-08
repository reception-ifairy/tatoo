import type { OptionGroup, OptionItem } from './options';

// The tattoo option groups shown in the option window. Style and technique options come from the compendium
// (server/tattooSet.ts adds them); everything else is defined here. Placements are limited on purpose: no
// intimate areas, and every preview happens on a sexless, featureless mannequin.

export type Aspect = '1:1' | '2:3' | '16:9';

export interface Placement {
  code: string;
  label: string;
  description: string;
  /** How the area is written in prompts. */
  prompt: string;
  /** What of the mannequin is shown in a preview (always cropped to the area). */
  mannequinView: string;
  aspect: Aspect;
  /** Highlight zone on the placement diagram (src/components/options/BodyDiagram.tsx). */
  zone: string;
  /** Fine lines blur faster where the skin moves a lot. */
  highMovement?: boolean;
  /** Hands, neck and face: high visibility, worth a cooling-off conversation. */
  highVisibility?: boolean;
}

export const PLACEMENTS: Placement[] = [
  { code: 'forearm_inner', label: 'Inner forearm', description: 'Flat, protected canvas that reads well to you and to others.', prompt: 'inner forearm', mannequinView: 'the forearm and hand of the mannequin, palm up, cropped at the elbow', aspect: '2:3', zone: 'forearm' },
  { code: 'forearm_outer', label: 'Outer forearm', description: 'The most visible arm placement; a tall shape follows the bone.', prompt: 'outer forearm', mannequinView: 'the forearm and hand of the mannequin, palm down, cropped at the elbow', aspect: '2:3', zone: 'forearm' },
  { code: 'upper_arm', label: 'Upper arm', description: 'Wraps around the biceps and triceps; easy to cover with a sleeve.', prompt: 'outer upper arm', mannequinView: 'the upper arm and shoulder of the mannequin, cropped at the elbow and the collarbone', aspect: '2:3', zone: 'upper_arm' },
  { code: 'shoulder', label: 'Shoulder cap', description: 'A rounded cap for circular and radiating designs.', prompt: 'shoulder cap', mannequinView: 'the shoulder and upper arm of the mannequin seen from the side', aspect: '1:1', zone: 'shoulder' },
  { code: 'half_sleeve', label: 'Half sleeve', description: 'Shoulder to elbow as one flowing composition.', prompt: 'half sleeve from shoulder to elbow', mannequinView: 'the whole arm of the mannequin from shoulder to elbow, seen from the side', aspect: '2:3', zone: 'upper_arm' },
  { code: 'full_sleeve', label: 'Full sleeve', description: 'Shoulder to wrist; a long project planned in sittings.', prompt: 'full sleeve from shoulder to wrist', mannequinView: 'the whole arm of the mannequin from shoulder to wrist, seen from the side', aspect: '2:3', zone: 'arm' },
  { code: 'wrist', label: 'Wrist', description: 'Small and delicate; lines need weight to last.', prompt: 'inner wrist', mannequinView: 'the wrist and hand of the mannequin, palm up', aspect: '1:1', zone: 'wrist', highMovement: true },
  { code: 'hand_back', label: 'Back of the hand', description: 'Always visible and fades faster. Worth a cooling-off period.', prompt: 'back of the hand', mannequinView: 'the hand of the mannequin seen from the back, cropped at the wrist', aspect: '1:1', zone: 'hand', highMovement: true, highVisibility: true },
  { code: 'shoulder_blade', label: 'Shoulder blade', description: 'A broad, flat area that hides easily.', prompt: 'shoulder blade', mannequinView: 'the upper back of the mannequin seen from behind, cropped at the waist', aspect: '1:1', zone: 'shoulder_blade' },
  { code: 'upper_back', label: 'Upper back', description: 'Across the shoulders: wide, symmetrical, strong.', prompt: 'upper back between the shoulders', mannequinView: 'the upper back and shoulders of the mannequin seen from behind, cropped at the waist', aspect: '16:9', zone: 'upper_back' },
  { code: 'spine', label: 'Along the spine', description: 'A narrow vertical line of motifs or script-like ornament.', prompt: 'along the spine', mannequinView: 'the back of the mannequin seen from behind, cropped at the waist', aspect: '2:3', zone: 'spine' },
  { code: 'full_back', label: 'Full back', description: 'The largest canvas: a full composition in many sittings.', prompt: 'full back piece', mannequinView: 'the whole back of the mannequin seen from behind, cropped at the waist', aspect: '2:3', zone: 'back' },
  { code: 'collarbone', label: 'Collarbone', description: 'A horizontal line under the neck; elegant for fine work.', prompt: 'along the collarbone', mannequinView: 'the collarbone and shoulders of the mannequin, cropped above the chest', aspect: '16:9', zone: 'collarbone' },
  { code: 'ribs_side', label: 'Side of the ribs', description: 'Tall and private, and one of the more painful places.', prompt: 'side of the ribcage', mannequinView: 'the side of the torso of the mannequin, arm raised, cropped at the waist and the armpit', aspect: '2:3', zone: 'ribs' },
  { code: 'thigh_outer', label: 'Outer thigh', description: 'Large, easy to hide, comfortable to tattoo.', prompt: 'outer thigh', mannequinView: 'the outer thigh of the mannequin from hip to knee, seen from the side', aspect: '2:3', zone: 'thigh' },
  { code: 'calf', label: 'Calf', description: 'A rounded muscle that suits tall, flowing designs.', prompt: 'calf', mannequinView: 'the lower leg of the mannequin from knee to ankle, seen from the back', aspect: '2:3', zone: 'calf' },
  { code: 'shin', label: 'Shin', description: 'Close to the bone; bold shapes read best here.', prompt: 'front of the shin', mannequinView: 'the lower leg of the mannequin from knee to ankle, seen from the front', aspect: '2:3', zone: 'shin' },
  { code: 'ankle', label: 'Ankle', description: 'Small pieces and bands; skin moves with every step.', prompt: 'outer ankle', mannequinView: 'the ankle and foot of the mannequin seen from the side', aspect: '1:1', zone: 'ankle', highMovement: true },
  { code: 'neck_side', label: 'Side of the neck', description: 'Highly visible. Worth a cooling-off period.', prompt: 'side of the neck', mannequinView: 'the side of the neck and shoulder of the mannequin, the faceless head turned away', aspect: '1:1', zone: 'neck', highVisibility: true },
  { code: 'behind_ear', label: 'Behind the ear', description: 'Tiny and discreet; best for very simple marks.', prompt: 'behind the ear', mannequinView: 'the side of the faceless mannequin head behind the ear', aspect: '1:1', zone: 'ear', highVisibility: true },
];

export function placementByCode(code: string | null | undefined): Placement | undefined {
  return PLACEMENTS.find((p) => p.code === code);
}

const item = (code: string, label: string, description: string, prompt: string, colors: string[] | null = null): OptionItem => ({ code, label, description, prompt, colors, sample: null });

export const SIZE_OPTIONS: OptionItem[] = [
  item('tiny', 'Tiny · ~3 cm', 'A small mark. Only very simple shapes survive at this size.', 'a tiny, very simple design about 3 cm across'),
  item('small', 'Small · ~6 cm', 'Room for one clear motif.', 'a small design about 6 cm across'),
  item('palm', 'Palm · ~10 cm', 'About the size of a palm: a motif with some detail.', 'a palm-sized design about 10 cm across'),
  item('medium', 'Medium · ~15 cm', 'A full motif with supporting elements.', 'a medium design about 15 cm tall'),
  item('large', 'Large · ~25 cm', 'A composition with depth and background.', 'a large design about 25 cm tall'),
  item('panel', 'Full panel', 'Covers the whole area chosen in Placement.', 'a large piece that fills the whole placement area'),
];

export const LINE_OPTIONS: OptionItem[] = [
  item('fine', 'Fine line', 'Delicate single-needle lines. Beautiful, but they soften with the years.', 'fine single-needle linework, delicate and precise'),
  item('medium', 'Medium line', 'Balanced lines that hold detail and age well.', 'clean medium-weight linework'),
  item('bold', 'Bold line', '"Bold will hold": thick outlines that read in ten years.', 'bold, heavy black outlines built to last'),
  item('mixed', 'Mixed weight', 'Bold outer contour, finer inner detail.', 'bold outer contour with finer interior linework'),
];

export const PALETTE_OPTIONS: OptionItem[] = [
  item('black_grey', 'Black & grey', 'Black with soft grey washes; timeless and forgiving.', 'black and grey only, soft grey wash shading', ['#0A0A0A', '#3F3F46', '#71717A', '#D4D4D8']),
  item('solid_black', 'Solid black', 'Pure black, no grey: maximum contrast.', 'solid black ink only, no grey tones', ['#000000', '#0A0A0A', '#18181B']),
  item('black_red', 'Black + red', 'Black with a single red accent.', 'black ink with a single red accent colour', ['#0A0A0A', '#B91C1C', '#DC2626']),
  item('traditional', 'Traditional primaries', 'Red, yellow, green and black, flat and bold.', 'classic traditional palette of red, yellow, green and black, flat fills', ['#B91C1C', '#EAB308', '#15803D', '#0A0A0A']),
  item('ochre_earth', 'Ochre & earth', 'The oldest pigments: ochre, rust, umber.', 'earthy palette of ochre, rust, umber and black', ['#C2410C', '#B45309', '#78350F', '#1C1917']),
  item('jewel', 'Jewel tones', 'Deep emerald, sapphire, ruby and gold.', 'rich jewel tones: emerald, sapphire, ruby and gold accents', ['#047857', '#1D4ED8', '#9F1239', '#CA8A04']),
  item('pastel_watercolour', 'Watercolour pastels', 'Soft washes of colour that bleed past the lines.', 'soft watercolour pastel washes bleeding gently past the linework', ['#F9A8D4', '#A5B4FC', '#99F6E4', '#FDE68A']),
  item('ocean_blue', 'Ocean blues', 'Indigo to teal, cool and calm.', 'cool palette of indigo, blue and teal', ['#1E3A8A', '#2563EB', '#0D9488', '#99F6E4']),
  item('neon', 'Neon accents', 'Black base with electric accents.', 'black linework with electric neon accents of magenta and cyan', ['#0A0A0A', '#E11D48', '#06B6D4', '#A3E635']),
  item('white_ink', 'White ink', 'White highlights or a pale, subtle mark.', 'white ink highlights over a pale design', ['#FFFFFF', '#E5E7EB', '#9CA3AF']),
];

export const COMPOSITION_OPTIONS: OptionItem[] = [
  item('single_motif', 'Single motif', 'One clear subject with breathing space.', 'a single clear motif with breathing space around it'),
  item('vertical_flow', 'Vertical flow', 'A tall shape that follows the limb or spine.', 'a tall vertical composition that flows along the body'),
  item('circular', 'Circular badge', 'A round, contained design.', 'a contained circular composition'),
  item('symmetrical', 'Symmetrical', 'Mirrored halves: ornamental, calm, centred.', 'a perfectly symmetrical, centred composition'),
  item('wraparound', 'Wraparound', 'Moves around the limb rather than sitting on it.', 'a composition designed to wrap around the limb'),
  item('band', 'Band', 'A ring around the arm, leg or wrist.', 'a horizontal band composition that circles the limb'),
  item('negative_space', 'Negative space', 'Skin itself forms part of the image.', 'bold use of negative space, letting bare skin form part of the image'),
  item('framed', 'Framed vignette', 'A scene inside a frame or border.', 'a framed vignette with a decorative border'),
  item('cluster', 'Scattered cluster', 'Several small elements arranged as one.', 'a loose cluster of small related elements arranged as one piece'),
];

export const MOOD_OPTIONS: OptionItem[] = [
  item('protect', 'Protect', 'A guardian: strength held quietly.', 'a protective, guardian-like presence, steady and strong'),
  item('remember', 'Remember', 'A memorial: tender, lasting.', 'a tender, memorial feeling, gentle and lasting'),
  item('release', 'Release', 'Letting go: lightness and movement.', 'a feeling of release and lightness, open and moving'),
  item('celebrate', 'Celebrate', 'Joy and triumph.', 'a joyful, celebratory energy'),
  item('serene', 'Serene', 'Calm, balanced, unhurried.', 'a serene, balanced calm'),
  item('wild', 'Wild', 'Raw, untamed, alive.', 'a raw, untamed, wild energy'),
  item('sublime', 'Dark sublime', 'Shadow and awe without horror for its own sake.', 'a dark, sublime atmosphere of shadow and awe'),
  item('mystic', 'Mystic', 'Symbol, ritual, quiet magic.', 'a mystical, ritual atmosphere'),
  item('playful', 'Playful', 'Light, witty, a little cheeky.', 'a playful, light-hearted character'),
];

/** Groups that don't depend on the compendium. Order = order in the generator. */
export const STATIC_GROUPS: OptionGroup[] = [
  {
    id: 'placement', label: 'Placement', description: 'Where on the body it lives. Previews use a neutral mannequin.', promptLabel: null,
    kind: 'diagram', tone: '#38bdf8', icon: 'Shapes',
    options: PLACEMENTS.map((p) => item(p.code, p.label, p.description, p.prompt)),
  },
  { id: 'size', label: 'Size', description: 'Roughly how big it is on the body.', promptLabel: 'Size', kind: 'diagram', tone: '#34d399', icon: 'Frame', options: SIZE_OPTIONS },
  { id: 'line', label: 'Line weight', description: 'How heavy the lines are, and how they will age.', promptLabel: 'Linework', kind: 'diagram', tone: '#fbbf24', icon: 'Brush', options: LINE_OPTIONS },
  { id: 'palette', label: 'Palette', description: 'The ink colours. A stencil is always black line only.', promptLabel: 'Palette', kind: 'palette', tone: '#fb7185', icon: 'Palette', options: PALETTE_OPTIONS },
  { id: 'composition', label: 'Composition', description: 'The shape and flow of the design.', promptLabel: 'Composition', kind: 'diagram', tone: '#a3e635', icon: 'Layers', options: COMPOSITION_OPTIONS },
  { id: 'mood', label: 'Mood', description: 'What the piece should feel like.', promptLabel: 'Mood', kind: 'sample', tone: '#e879f9', icon: 'Sparkles', options: MOOD_OPTIONS },
];

/**
 * Closes every tattoo image prompt. Safety first: no nudity, nothing sexual, no real people, no franchise characters,
 * no text the model would misspell, no copying of sacred or closed designs.
 */
export const TATTOO_HOUSE_RULES =
  'Absolutely no nudity and nothing sexual or suggestive. No real, identifiable people and no film, cartoon, game or franchise characters. No text, letters, numbers, logos, watermarks or signatures. Original artwork that does not copy any existing tattoo or any sacred or closed traditional design.';

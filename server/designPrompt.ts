import type { OutputKind } from '../src/account';
import type { DesignBrief, DesignWarning } from '../src/design';
import { TATTOO_HOUSE_RULES, placementByCode, type Aspect } from '../src/tattooOptions';
import { tattooSet } from './tattooSet';
import { styleById } from './compendium';

// Turns a brief into the English image prompt for one output kind. The same brief always says the same thing;
// only the surface changes: a black-line stencil on white, a finished colour design on paper, or a preview on a
// sexless, featureless mannequin. Never a real body, except the client's own cropped scar photo in the scar service.

export interface ComposedPrompt {
  prompt: string;
  aspect: Aspect;
  warnings: DesignWarning[];
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/\.+$/, '');

function picked(brief: DesignBrief, groupId: string) {
  const group = tattooSet().groups.find((g) => g.id === groupId);
  const option = group?.options.find((o) => o.code === brief.picks[groupId]);
  return group && option ? { group, option } : null;
}

const MANNEQUIN =
  'a smooth, matte, light-grey featureless display mannequin, abstract and sexless like a shop mannequin, with no face, no hair and no anatomical detail';

export function composeDesignPrompt(kind: OutputKind, brief: DesignBrief, opts: { withReference?: boolean } = {}): ComposedPrompt {
  const warnings: DesignWarning[] = [];
  const subject = clean(brief.subject) || 'an original symbolic motif';
  const style = picked(brief, 'style');
  const technique = picked(brief, 'technique');
  const placementPick = picked(brief, 'placement');
  const placement = placementByCode(placementPick?.option.code);
  const size = picked(brief, 'size');
  const line = picked(brief, 'line');
  const palette = picked(brief, 'palette');
  const composition = picked(brief, 'composition');
  const mood = picked(brief, 'mood');

  const styleText = style ? style.option.prompt : 'a clean contemporary tattoo style';
  const parts: string[] = [];
  const add = (s: string | null | undefined) => s && parts.push(`${clean(s)}.`);

  // Cultural guardrail: a closed tradition is only ever an openly inspired abstraction.
  const level = style?.option.cultural ?? null;
  const styleName = style?.option.label ?? '';
  if (level === 'closed' || brief.culturalCheck === 'inspired_not_copied') {
    if (level === 'closed') warnings.push({ code: 'closed_culture', vars: { style: styleName } });
  } else if (level === 'sensitive') {
    warnings.push({ code: 'sensitive_culture', vars: { style: styleName } });
  }
  const culturalClause =
    level === 'closed' || brief.culturalCheck === 'inspired_not_copied'
      ? `This is an original design only loosely inspired by the rhythm and flow of ${styleName || 'the tradition'}; it must not reproduce any traditional, sacred or genealogical motif or pattern`
      : null;

  if (line?.option.code === 'fine' && placement?.highMovement) {
    warnings.push({ code: 'fine_line_movement', vars: { placement: placement.label } });
  }
  if (placement?.highVisibility) warnings.push({ code: 'high_visibility', vars: { placement: placement.label } });

  const lineText = line
    ? `${line.option.prompt}${line.option.code === 'fine' && placement?.highMovement ? ', with slightly thickened accents so it holds on a moving area' : ''}`
    : null;
  const shapeFor = placement ? `shaped to sit on the ${placement.prompt}` : null;

  if (kind === 'stencil') {
    if (palette && palette.option.code !== 'black_grey' && palette.option.code !== 'solid_black') {
      warnings.push({ code: 'stencil_palette', vars: {} });
    }
    add(`A tattoo stencil: clean line drawing of ${subject}, in ${styleText}`);
    add(technique && `Line technique: ${technique.option.prompt}, translated into linework only`);
    add(lineText && `Linework: ${lineText}`);
    add(composition && `Composition: ${composition.option.prompt}`);
    add(shapeFor);
    add(size && `Scale: ${size.option.prompt}`);
    add(mood && `Mood: ${mood.option.prompt}`);
    add(brief.notes && `Notes: ${brief.notes}`);
    add(culturalClause);
    add('Pure black ink lines on a pure white background, no colour, no grey wash, no filled shading (only line, hatching or dots where the style needs them). Flat 2D line art, isolated and centred with a white margin, crisp and ready to transfer. Not a photograph, no skin, no body');
  } else if (kind === 'colour') {
    add(`A finished tattoo flash design of ${subject}, in ${styleText}`);
    add(technique && `Technique: ${technique.option.prompt}`);
    add(palette ? `Palette: ${palette.option.prompt}` : 'Palette: chosen to suit the style');
    add(lineText && `Linework: ${lineText}`);
    add(composition && `Composition: ${composition.option.prompt}`);
    add(shapeFor);
    add(size && `Scale: ${size.option.prompt}`);
    add(mood && `Mood: ${mood.option.prompt}`);
    add(brief.notes && `Notes: ${brief.notes}`);
    add(culturalClause);
    add('Presented as tattoo flash art on plain off-white paper, isolated and centred, crisp confident linework, high detail. Flat 2D illustration, not a photograph, no skin, no body');
  } else {
    const view = placement?.mannequinView ?? 'the forearm and hand of the mannequin, cropped at the elbow';
    if (opts.withReference) {
      add(`Show exactly the tattoo design in the reference picture applied as a healed tattoo onto ${MANNEQUIN}`);
      add(`Frame only ${view}`);
      add(placement && `The tattoo sits on the ${placement.prompt}, following the form of the mannequin`);
      add(size && `Scale: ${size.option.prompt}`);
      add('Keep the design, its colours and its proportions unchanged');
    } else {
      add(`A preview of a tattoo on ${MANNEQUIN}`);
      add(`Frame only ${view}`);
      add(`The tattoo shows ${subject}, in ${styleText}`);
      add(technique && `Technique: ${technique.option.prompt}`);
      add(palette && `Palette: ${palette.option.prompt}`);
      add(lineText && `Linework: ${lineText}`);
      add(composition && `Composition: ${composition.option.prompt}`);
      add(placement && `It sits on the ${placement.prompt}, following the form`);
      add(size && `Scale: ${size.option.prompt}`);
      add(mood && `Mood: ${mood.option.prompt}`);
      add(brief.notes && `Notes: ${brief.notes}`);
      add(culturalClause);
    }
    add('Neutral mid-grey studio backdrop, soft even product lighting, sharp focus on the tattoo. The mannequin is not a person: no real skin, no face, nothing sexual, fully neutral');
  }
  parts.push(TATTOO_HOUSE_RULES);

  const aspect: Aspect = kind === 'mannequin' ? placement?.aspect ?? '2:3' : placement?.aspect === '16:9' ? '16:9' : placement?.aspect === '2:3' ? '2:3' : '1:1';
  return { prompt: parts.join(' '), aspect, warnings };
}

/** The scar cover-up edit: the client's cropped photo goes in as the picture to edit. */
export function composeScarPrompt(brief: DesignBrief): ComposedPrompt {
  const base = composeDesignPrompt('colour', brief);
  const style = picked(brief, 'style');
  const palette = picked(brief, 'palette');
  const line = picked(brief, 'line');
  const subject = clean(brief.subject) || 'an organic motif chosen to camouflage the scar';
  const parts = [
    'Edit this close-up photo of skin with a scar.',
    `Add a healed, professionally made cover-up tattoo of ${subject}, in ${style ? style.option.prompt : 'a style that suits the shape of the scar'}.`,
    'The design follows the shape and direction of the scar and uses its lines, texture and shading to camouflage it, with soft edges where the skin is raised or uneven.',
    palette ? `Palette: ${clean(palette.option.prompt)}.` : '',
    line ? `Linework: ${clean(line.option.prompt)}.` : '',
    brief.notes ? `Notes: ${clean(brief.notes)}.` : '',
    'Keep the same framing, the same skin tone and the same lighting as the photo. Change nothing outside the tattoo. Do not add any person, face, body part or background.',
    TATTOO_HOUSE_RULES,
  ];
  return { prompt: parts.filter(Boolean).join(' '), aspect: '1:1', warnings: base.warnings.filter((w) => w.code !== 'stencil_palette') };
}

/** Short title for a new project from its subject. */
export function titleFromBrief(brief: DesignBrief): string {
  const s = clean(brief.subject);
  const styleName = brief.picks.style ? styleById(brief.picks.style)?.name : null;
  const base = s || styleName || 'New design';
  return base.length > 60 ? `${base.slice(0, 57)}…` : base;
}

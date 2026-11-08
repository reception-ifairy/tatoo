import type { CulturalCheck, DesignBrief } from '../src/design';
import { PLACEMENTS, SIZE_OPTIONS, LINE_OPTIONS, PALETTE_OPTIONS, COMPOSITION_OPTIONS, MOOD_OPTIONS } from '../src/tattooOptions';
import { compendium, matchStyle } from './compendium';

// Reads the design_spec and studio_brief blocks Ötzi writes and maps the spec onto the generator's options.
// Anything that doesn't match an option is simply left unpicked (the client can choose it in the window).

function lastBlock(text: string, name: string): string | null {
  const re = new RegExp('```' + name + '\\s*\\n([\\s\\S]*?)```', 'g');
  let m: RegExpExecArray | null;
  let last: string | null = null;
  while ((m = re.exec(text))) last = m[1];
  return last;
}

function fields(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const m = /^\s*([a-z_]+)\s*:\s*(.*)$/i.exec(line);
    if (m) out[m[1].toLowerCase()] = m[2].trim().replace(/^<|>$/g, '');
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function code(value: string | undefined, options: { code: string; label: string }[]): string | null {
  if (!value) return null;
  const v = norm(value);
  const first = v.split(' ')[0];
  return (
    options.find((o) => norm(o.code) === v || norm(o.label) === v)?.code ??
    options.find((o) => v.startsWith(norm(o.code)) || v.startsWith(norm(o.label)))?.code ??
    options.find((o) => norm(o.code) === first)?.code ??
    null
  );
}

export function parseDesignSpec(text: string): DesignBrief | null {
  const block = lastBlock(text, 'design_spec');
  if (!block) return null;
  const f = fields(block);
  if (!f.subject) return null;
  const picks: Record<string, string> = {};
  const style = matchStyle(f.style);
  if (style) picks.style = style.id;
  const technique = f.technique ? compendium().techniques.find((t) => norm(t.name) === norm(f.technique) || norm(t.id) === norm(f.technique)) : undefined;
  if (technique) picks.technique = technique.id;
  const set = (group: string, value: string | undefined, options: { code: string; label: string }[]) => {
    const c = code(value, options);
    if (c) picks[group] = c;
  };
  set('placement', f.placement, PLACEMENTS);
  set('size', f.size, SIZE_OPTIONS);
  set('line', f.line_weight, LINE_OPTIONS);
  set('palette', f.palette, PALETTE_OPTIONS);
  set('composition', f.composition, COMPOSITION_OPTIONS);
  set('mood', f.mood, MOOD_OPTIONS);
  const cc = (f.cultural_check || 'clear').toLowerCase();
  const culturalCheck: CulturalCheck = cc.startsWith('flag') ? 'flagged' : cc.startsWith('inspired') ? 'inspired_not_copied' : 'clear';
  return {
    subject: f.subject.slice(0, 400),
    picks,
    notes: (f.notes ?? '').slice(0, 400),
    culturalCheck,
  };
}

export function parseStudioBrief(text: string): string | null {
  const block = lastBlock(text, 'studio_brief');
  return block ? block.trim().slice(0, 6000) : null;
}

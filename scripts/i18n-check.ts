// Lists the English UI strings that have no Polish translation in src/i18n/pl.ts.
// Run: npm run i18n   (add --json to print a JSON skeleton of the missing entries)
import fs from 'fs';
import path from 'path';
import { PL, PL_PLURALS } from '../src/i18n/pl';
import { SECTIONS, SETTINGS_ITEM, LOGOUT_ITEM } from '../src/lib/sections';
import { STATIC_GROUPS } from '../src/tattooOptions';
import { DEFAULT_PACKAGES } from '../src/account';
import { EVIDENCE_LABEL } from '../src/compendium';
import { PROVIDER_INFO, MALE_VOICES } from '../src/aiSettings';
import { IMAGE_GROUPS, IMAGE_MODELS } from '../src/imageModels';
import { KIND_INFO } from '../src/components/design/kinds';

const keys = new Set<string>();
const plurals = new Set<string>();

function walk(dir: string) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|ts)$/.test(f) && !p.includes(`i18n${path.sep}pl.ts`)) {
      const src = fs.readFileSync(p, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)+)'/g)) keys.add(m[1].replace(/\\'/g, "'"));
      for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)+)"/g)) keys.add(m[1]);
      for (const m of src.matchAll(/\btp\(\s*[^,]+,\s*'((?:[^'\\]|\\.)+)'/g)) plurals.add(m[1]);
    }
  }
}
walk(path.join(process.cwd(), 'src'));

// Text that comes from constants and is rendered through t(variable).
for (const s of SECTIONS) keys.add(s.label).add(s.subtitle);
keys.add(SETTINGS_ITEM.label).add(LOGOUT_ITEM.label);
for (const g of STATIC_GROUPS) {
  keys.add(g.label).add(g.description);
  for (const o of g.options) keys.add(o.label).add(o.description);
}
keys.add('Style').add('The visual language, from the compendium.').add('Technique').add('How lines, shading and colour are laid in.');
for (const p of DEFAULT_PACKAGES) keys.add(p.description);
for (const k of Object.values(KIND_INFO)) keys.add(k.label).add(k.note);
for (const l of Object.values(EVIDENCE_LABEL)) keys.add(l);
for (const p of Object.values(PROVIDER_INFO)) keys.add(p.engineNote);
for (const v of MALE_VOICES) keys.add(v.label);
for (const g of IMAGE_GROUPS) keys.add(g.label);
for (const m of IMAGE_MODELS) keys.add(m.note);

// Server messages the admin sees through t() (blockers, errors): every 'English sentence.' in server/*.ts.
function walkServer(dir: string) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walkServer(p);
    else if (f.endsWith('.ts')) {
      for (const m of fs.readFileSync(p, 'utf8').matchAll(/(?:ResearchError\(|blocker = (?:blocker \?\? )?|error: )'([A-Z][^'$]{8,}[.)])'/g)) keys.add(m[1]);
    }
  }
}
walkServer(path.join(process.cwd(), 'server'));

const missing = [...keys].filter((k) => !(k in PL)).sort();
const missingPlurals = [...plurals].filter((k) => !(k in PL_PLURALS)).sort();
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(Object.fromEntries(missing.map((k) => [k, ''])), null, 2));
  console.log(JSON.stringify(Object.fromEntries(missingPlurals.map((k) => [k, ['', '', '']])), null, 2));
} else {
  console.log(`${keys.size} strings, ${missing.length} without Polish; ${plurals.size} plurals, ${missingPlurals.length} without Polish.`);
  for (const k of missing) console.log(`  ${k}`);
  for (const k of missingPlurals) console.log(`  [plural] ${k}`);
  if (missing.length || missingPlurals.length) process.exitCode = 1;
}

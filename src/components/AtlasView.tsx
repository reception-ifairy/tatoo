import React from 'react';
import { Layers3, PenTool, Sparkles, Search, Loader2, Wand2, MessagesSquare, ShieldAlert, BookOpen } from 'lucide-react';
import { EVIDENCE_LABEL, culturalLevel, type Compendium, type KeyFact, type TattooStyle, type TattooTechnique, type Fusion } from '../compendium';
import { useI18n } from '../i18n';
import { getSection } from '../lib/sections';
import { useApp } from '../lib/appContext';
import { cn } from '../lib/utils';
import ViewHeader, { ViewBody } from './shell/ViewHeader';
import Pager from './ui/Pager';
import Sheet from './ui/Sheet';

// The compendium as an atlas: styles, techniques and fusions with categories, search and a detail sheet.
// Content stays in English (it is the research corpus); the interface around it follows the user's language.

type Tab = 'styles' | 'techniques' | 'fusions';
type Selected = { kind: 'style'; item: TattooStyle } | { kind: 'technique'; item: TattooTechnique } | { kind: 'fusion'; item: Fusion } | null;

const match = (q: string, ...fields: (string | string[])[]) => !q || fields.some((f) => (Array.isArray(f) ? f.join(' ') : f).toLowerCase().includes(q));

export default function AtlasView() {
  const section = getSection('atlas');
  const { t } = useI18n();
  const { compendium, openGenerator, startChat, user } = useApp();
  const [tab, setTab] = React.useState<Tab>('styles');
  const [category, setCategory] = React.useState('all');
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState<Selected>(null);

  if (!compendium) {
    return (
      <>
        <ViewHeader section={section} />
        <ViewBody><p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> {t('Loading…')}</p></ViewBody>
      </>
    );
  }
  const q = query.trim().toLowerCase();
  const categories = tab === 'styles' ? compendium.styleCategories : tab === 'techniques' ? compendium.techniqueCategories : [];
  const styles = compendium.styles.filter((s) => (category === 'all' || s.category === category) && match(q, s.name, s.description, s.commonMotifs));
  const techniques = compendium.techniques.filter((x) => (category === 'all' || x.category === category) && match(q, x.name, x.description));
  const fusions = compendium.mixedStyles.examples.filter((f) => match(q, f.name, f.combination));
  const name = (id: string) => compendium.styles.find((s) => s.id === id)?.name ?? compendium.techniques.find((x) => x.id === id)?.name ?? id;
  const consult = user.role === 'admin' || Boolean(user.package?.consultation);

  const tabs: { id: Tab; label: string; icon: typeof Layers3; count: number }[] = [
    { id: 'styles', label: t('Styles'), icon: Layers3, count: compendium.styles.length },
    { id: 'techniques', label: t('Techniques'), icon: PenTool, count: compendium.techniques.length },
    { id: 'fusions', label: t('Fusions'), icon: Sparkles, count: compendium.mixedStyles.examples.length },
  ];

  return (
    <>
      <ViewHeader section={section} subtitle={`${t(section.subtitle)} · v${compendium.meta.version}`} />
      <ViewBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex rounded-xl border border-white/10 overflow-hidden" role="tablist">
            {tabs.map((x) => (
              <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => { setTab(x.id); setCategory('all'); }} className={cn('h-12 px-4 text-sm flex items-center gap-2', tab === x.id ? 'bg-sky-400/15 text-sky-200' : 'text-slate-400')}>
                <x.icon size={16} /> {x.label} <span className="font-mono text-xs opacity-70">{x.count}</span>
              </button>
            ))}
          </div>
          <label className="relative flex-1 min-w-[12rem] max-w-sm">
            <span className="sr-only">{t('Search')}</span>
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Search the atlas…')} className="field h-12 pl-10" />
          </label>
        </div>
        {categories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto shrink-0 pb-1">
            {[{ id: 'all', name: t('All') }, ...categories].map((c) => (
              <button key={c.id} type="button" onClick={() => setCategory(c.id)} className={cn('h-10 px-3 rounded-full border text-xs whitespace-nowrap', category === c.id ? 'border-sky-400/60 bg-sky-400/10 text-sky-100' : 'border-white/10 text-slate-400')}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        {tab === 'styles' && (
          <Pager items={styles} getKey={(s) => s.id} minItemWidth={250} itemHeight={150} label={t('Styles')} className="flex-1 min-h-0" resetKey={`${tab}-${category}-${q}`}
            renderItem={(s) => (
              <Card title={s.name} meta={compendium.styleCategories.find((c) => c.id === s.category)?.name ?? ''} text={s.fieldNote || s.description} flag={culturalLevel(s.id)} onClick={() => setSelected({ kind: 'style', item: s })} />
            )}
          />
        )}
        {tab === 'techniques' && (
          <Pager items={techniques} getKey={(x) => x.id} minItemWidth={250} itemHeight={150} label={t('Techniques')} className="flex-1 min-h-0" resetKey={`${tab}-${category}-${q}`}
            renderItem={(x) => (
              <Card title={x.name} meta={`${compendium.techniqueCategories.find((c) => c.id === x.category)?.name ?? ''} · ${x.difficulty}`} text={x.fieldNote || x.description} onClick={() => setSelected({ kind: 'technique', item: x })} />
            )}
          />
        )}
        {tab === 'fusions' && (
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            <p className="text-sm text-slate-400 shrink-0">{compendium.mixedStyles.description}</p>
            <Pager items={fusions} getKey={(f) => f.name} minItemWidth={250} itemHeight={120} label={t('Fusions')} className="flex-1 min-h-0" resetKey={`${tab}-${q}`}
              renderItem={(f) => <Card title={f.name} meta={f.combination.map(name).join(' + ')} text="" onClick={() => setSelected({ kind: 'fusion', item: f })} />}
            />
          </div>
        )}
      </ViewBody>

      <Sheet open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.item.name ?? ''} icon={BookOpen} tone={section.tone} widthClass="max-w-3xl">
        {selected?.kind === 'style' && <StyleDetail s={selected.item} compendium={compendium} name={name} />}
        {selected?.kind === 'technique' && <TechniqueDetail x={selected.item} name={name} />}
        {selected?.kind === 'fusion' && <p className="text-slate-200">{selected.item.combination.map(name).join(' + ')}</p>}
        {selected && (
          <div className="flex flex-wrap gap-2 pt-4">
            {selected.kind !== 'fusion' && (
              <button
                type="button"
                onClick={() => {
                  const picks = selected.kind === 'style' ? { style: selected.item.id } : { technique: selected.item.id };
                  setSelected(null);
                  openGenerator({ picks });
                }}
                className="h-12 px-4 rounded-xl bg-pink-400 text-black font-semibold text-sm flex items-center gap-2"
              >
                <Wand2 size={16} /> {t('Use in the generator')}
              </button>
            )}
            {consult && (
              <button
                type="button"
                onClick={() => {
                  const n = selected.item.name;
                  setSelected(null);
                  startChat(t('Tell me about {name} — is it right for me?', { name: n }));
                }}
                className="h-12 px-4 rounded-xl border border-amber-400/40 text-amber-200 text-sm flex items-center gap-2"
              >
                <MessagesSquare size={16} /> {t('Ask Ötzi')}
              </button>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}

function Card({ title, meta, text, flag, onClick }: { title: string; meta: string; text: string; flag?: 'closed' | 'sensitive' | null; onClick: () => void }) {
  const t = useI18n().t;
  return (
    <button type="button" onClick={onClick} className="panel w-full h-full p-4 text-left flex flex-col gap-1 overflow-hidden active:border-sky-400/50">
      <span className="flex items-center gap-2">
        <span className="font-display font-semibold text-white truncate flex-1">{title}</span>
        {flag && <ShieldAlert size={16} className={flag === 'closed' ? 'text-amber-300' : 'text-slate-400'} aria-label={flag === 'closed' ? t('Closed tradition') : t('Culturally sensitive')} />}
      </span>
      <span className="text-[11px] font-mono text-sky-300/80 truncate">{meta}</span>
      {text && <span className="text-sm text-slate-400 line-clamp-3">{text}</span>}
    </button>
  );
}

function Facts({ facts }: { facts: KeyFact[] }) {
  const t = useI18n().t;
  if (!facts.length) return null;
  return (
    <section className="space-y-1.5">
      <h4 className="field-label">{t('Key facts')}</h4>
      <ul className="space-y-1.5">
        {facts.map((f, i) => (
          <li key={i} className="text-sm text-slate-300 flex gap-2">
            <span className={cn('shrink-0 h-6 px-2 rounded-full text-[10px] font-mono flex items-center', f.evidence === 'contested' || f.evidence === 'hypothesis' || f.evidence === 'unknown' ? 'bg-amber-400/15 text-amber-200' : 'bg-white/5 text-slate-400')}>
              {t(EVIDENCE_LABEL[f.evidence])}
            </span>
            <span>{f.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StyleDetail({ s, compendium, name }: { s: TattooStyle; compendium: Compendium; name: (id: string) => string }) {
  const t = useI18n().t;
  const level = culturalLevel(s.id);
  const paper = compendium.articles.find((a) => a.id === s.sourcePaper);
  return (
    <div className="space-y-4">
      {level && (
        <p className="p-3 rounded-xl border border-amber-400/40 bg-amber-400/10 text-sm text-amber-100 flex gap-2">
          <ShieldAlert size={18} className="shrink-0" />
          {level === 'closed'
            ? t('A living tradition with its own lineage and meaning. Its marks are not copied; any design here is openly inspired, never reproduced.')
            : t('Carries cultural or religious weight. Learn its meaning before you wear it.')}
        </p>
      )}
      <p className="text-slate-200">{s.description}</p>
      {s.fieldNote && <p className="text-sm italic text-sky-200">“{s.fieldNote}”</p>}
      <Field label={t('History')} text={s.history} />
      <Field label={t('Distinct features')} text={s.distinctFeatures} />
      {s.commonMotifs.length > 0 && <Field label={t('Common motifs')} text={s.commonMotifs.join(', ')} />}
      {s.relatedTechniques.length > 0 && <Field label={t('Techniques')} text={s.relatedTechniques.map(name).join(', ')} />}
      {s.relatedStyles.length > 0 && <Field label={t('Related styles')} text={s.relatedStyles.map(name).join(', ')} />}
      <Facts facts={s.keyFacts} />
      {paper && <p className="text-xs font-mono text-slate-500">{t('Source')}: {paper.id} · {paper.title}</p>}
    </div>
  );
}

function TechniqueDetail({ x, name }: { x: TattooTechnique; name: (id: string) => string }) {
  const t = useI18n().t;
  return (
    <div className="space-y-4">
      <p className="text-slate-200">{x.description}</p>
      {x.fieldNote && <p className="text-sm italic text-sky-200">“{x.fieldNote}”</p>}
      <Field label={t('Difficulty')} text={x.difficulty} />
      {x.usedInStyles.length > 0 && <Field label={t('Used in')} text={x.usedInStyles.map(name).join(', ')} />}
      <Facts facts={x.keyFacts} />
    </div>
  );
}

function Field({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <section>
      <h4 className="field-label">{label}</h4>
      <p className="text-sm text-slate-300">{text}</p>
    </section>
  );
}

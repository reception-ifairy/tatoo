import React from 'react';
import { Plus, Images, ImagePlus, Loader2, AlertTriangle, Eraser, X, Sparkles, Info, ShieldAlert, Save, Check } from 'lucide-react';
import type { OutputKind } from '../account';
import { remaining } from '../account';
import type { DesignBrief, DesignImage, DesignWarning, GenerationEstimate, Project } from '../design';
import { EMPTY_BRIEF } from '../design';
import { formatUsd } from '../imageModels';
import { useI18n } from '../i18n';
import { getSection } from '../lib/sections';
import { useApp, type GeneratorRequest } from '../lib/appContext';
import { api } from '../lib/appApi';
import { loadJson, saveJson } from '../lib/settings';
import { cn } from '../lib/utils';
import { APP } from '../config';
import ViewHeader, { ViewBody, HeaderButton } from './shell/ViewHeader';
import OptionWindow from './options/OptionWindow';
import SamplesSheet from './options/SamplesSheet';
import { missingSamples } from '../options';
import OptionVisual, { GroupIcon } from './options/OptionVisual';
import { KIND_INFO } from './design/PackageCard';
import ImageSheet, { DesignThumb } from './design/ImageSheet';

// The generator: a design brief (motif + options chosen in the option window) and three outputs — a black-line
// stencil (transparent PNG), a finished colour design, and a preview on a neutral grey mannequin. Every picture
// is paid: the admin sees the cost on the button; a client sees how many are left in the package. Nothing is ever
// generated without a click. The brief is saved to the project as you go.

const KINDS: OutputKind[] = ['stencil', 'colour', 'mannequin'];
const LAST_KEY = `${APP.id}_last_project`;

export function warningText(w: DesignWarning, t: (s: string, v?: Record<string, string | number>) => string): string {
  switch (w.code) {
    case 'fine_line_movement':
      return t('Fine lines on the {placement} soften quickly where the skin moves; the accents will be drawn a little heavier.', { placement: t(w.vars.placement) });
    case 'closed_culture':
      return t('{style} belongs to a living tradition with its own lineage. The design will only be loosely inspired by it — nothing traditional or sacred is reproduced.', { style: w.vars.style });
    case 'sensitive_culture':
      return t('{style} carries cultural or religious weight. Talk the meaning through with Ötzi and your artist.', { style: w.vars.style });
    case 'high_visibility':
      return t('The {placement} is always visible. Give yourself a cooling-off period before you book.', { placement: t(w.vars.placement) });
    case 'stencil_palette':
      return t('A stencil is black linework only; the palette shows in the colour design.');
  }
}

export default function GeneratorView({ request }: { request: GeneratorRequest | null }) {
  const section = getSection('generator');
  const { t, tp } = useI18n();
  const { user, optionSet, setOptionSet, refreshUser, projectsChanged, navigate, openSettings } = useApp();
  const [samplesOpen, setSamplesOpen] = React.useState(false);
  const isAdmin = user.role === 'admin';
  const [project, setProject] = React.useState<Project | null>(null);
  const [brief, setBrief] = React.useState<DesignBrief>(EMPTY_BRIEF);
  const [openGroup, setOpenGroup] = React.useState<string | null>(null);
  const [kind, setKind] = React.useState<OutputKind>('stencil');
  const [estimate, setEstimate] = React.useState<GenerationEstimate | null>(null);
  const [estimating, setEstimating] = React.useState(false);
  const [running, setRunning] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(true);
  const [zoom, setZoom] = React.useState<DesignImage | null>(null);
  const controller = React.useRef<AbortController | null>(null);
  const lastKey = `${LAST_KEY}_${user.id}`;

  const load = React.useCallback(async (id: string) => {
    try {
      const p = await api.project(id);
      if (p.type === 'scar') return;
      setProject(p);
      setBrief(p.brief);
      setSaved(true);
      saveJson(lastKey, p.id);
    } catch {
      saveJson(lastKey, null);
    }
  }, [lastKey]);

  // Reopen the last design on this device.
  React.useEffect(() => {
    const last = loadJson<string | null>(lastKey, null);
    if (last) load(last);
  }, [lastKey, load]);

  // Requests from other views: open a project, start from a consultation's design, or merge an atlas pick.
  React.useEffect(() => {
    if (!request) return;
    setError(null);
    if (request.projectId) load(request.projectId);
    else if (request.brief) {
      api.createProject({ brief: request.brief, studioBrief: request.studioBrief ?? null, conversationId: request.conversationId ?? null }).then(
        (p) => {
          setProject(p);
          setBrief(p.brief);
          setSaved(true);
          saveJson(lastKey, p.id);
          projectsChanged();
        },
        (err) => setError(err.message),
      );
    } else if (request.picks) {
      setBrief((b) => ({ ...b, picks: { ...b.picks, ...request.picks } }));
      setSaved(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.nonce]);

  // Save the brief as you go (creates the project once there is something to save).
  React.useEffect(() => {
    if (saved) return;
    const timer = setTimeout(async () => {
      const hasContent = brief.subject.trim() || Object.keys(brief.picks).length;
      if (!hasContent) return;
      try {
        if (project) {
          const p = await api.patchProject(project.id, { brief });
          setProject(p);
        } else {
          const p = await api.createProject({ brief });
          setProject(p);
          saveJson(lastKey, p.id);
        }
        setSaved(true);
        projectsChanged();
      } catch (err: any) {
        setError(err.message);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [brief, saved, project, lastKey, projectsChanged]);

  // What the chosen output would cost / use, once the saved brief is on the server.
  React.useEffect(() => {
    if (!project || !saved) {
      setEstimate(null);
      return;
    }
    let live = true;
    setEstimating(true);
    api.estimate(project.id, kind).then(
      (e) => live && setEstimate(e),
      (err) => live && setError(err.message),
    ).finally(() => live && setEstimating(false));
    return () => {
      live = false;
    };
  }, [project?.id, project?.updatedAt, kind, saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<DesignBrief>) => {
    setBrief((b) => ({ ...b, ...patch }));
    setSaved(false);
  };
  const pick = (groupId: string, code: string) => update({ picks: { ...brief.picks, [groupId]: code } });

  const startNew = () => {
    controller.current?.abort();
    setProject(null);
    setBrief(EMPTY_BRIEF);
    setSaved(true);
    setEstimate(null);
    setError(null);
    saveJson(lastKey, null);
  };

  const generate = async () => {
    if (!project || !estimate || estimate.blocker) return;
    setError(null);
    setRunning(t('Starting…'));
    const c = new AbortController();
    controller.current = c;
    try {
      const { project: p, image } = await api.generate(project.id, kind, isAdmin ? estimate.costUsd : null, (e) => e.type === 'status' && setRunning(e.message), c.signal);
      setProject(p);
      setZoom(image);
      projectsChanged();
      refreshUser();
    } catch (err: any) {
      if (err?.name !== 'AbortError') setError(err.message);
    } finally {
      setRunning(null);
      controller.current = null;
    }
  };

  const chosen = optionSet
    ? optionSet.groups.flatMap((g) => {
        const option = g.options.find((o) => o.code === brief.picks[g.id]);
        return option ? [{ group: g, option }] : [];
      })
    : [];
  const images = project ? [...project.images].reverse().filter((i) => !i.fromPhoto) : [];
  const left = (k: OutputKind) => remaining(user, k);
  const flagged = brief.culturalCheck === 'flagged';
  const kindAvailable = (k: OutputKind) => isAdmin || (user.package?.limits[k] ?? 0) > 0;

  const buttonLabel = () => {
    const name = t(KIND_INFO[kind].label);
    if (!estimate) return name;
    if (isAdmin) return t('Make: {name} · {cost}', { name, cost: formatUsd(estimate.costUsd ?? 0) });
    return t('Make: {name} · {left} left', { name, left: estimate.remaining ?? 0 });
  };

  return (
    <>
      <ViewHeader section={section} subtitle={project ? <span className="truncate">{project.title}{!saved && ' · …'}{saved && <Check size={14} className="inline ml-1 text-emerald-400" />}</span> : undefined}>
        {isAdmin && optionSet && (
          <HeaderButton tone={missingSamples(optionSet).length ? 'amber' : 'neutral'} onClick={() => setSamplesOpen(true)} label={t('Thumbnails')}>
            <ImagePlus size={18} /> <span className="hidden xl:inline">{t('Thumbnails')}{missingSamples(optionSet).length ? ` (${missingSamples(optionSet).length})` : ''}</span>
          </HeaderButton>
        )}
        <HeaderButton onClick={() => navigate('projects')} label={t('My designs')}>
          <Images size={18} /> <span className="hidden lg:inline">{t('My designs')}</span>
        </HeaderButton>
        <HeaderButton tone="primary" onClick={startNew} disabled={Boolean(running)}>
          <Plus size={18} /> <span className="hidden sm:inline">{t('New design')}</span>
        </HeaderButton>
      </ViewHeader>

      <ViewBody className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-3">
          <section className="panel p-3 shrink-0 grid gap-2 lg:grid-cols-[1fr_16rem]">
            <div>
              <label htmlFor="gen-subject" className="field-label">{t('Motif')}</label>
              <textarea
                id="gen-subject"
                value={brief.subject}
                maxLength={400}
                rows={2}
                onChange={(e) => update({ subject: e.target.value })}
                placeholder={t('e.g. a swallow carrying a sprig of olive, flying upward')}
                className="field h-auto py-3 resize-none"
              />
            </div>
            <div>
              <label htmlFor="gen-notes" className="field-label">{t('Notes (optional)')}</label>
              <textarea
                id="gen-notes"
                value={brief.notes}
                maxLength={400}
                rows={2}
                onChange={(e) => update({ notes: e.target.value })}
                placeholder={t('e.g. wings a little taller')}
                className="field h-auto py-3 resize-none"
              />
            </div>
          </section>

          <section className="panel p-3 md:p-4 flex-1 min-h-0 flex flex-col gap-3">
            {!optionSet ? (
              <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> {t('Loading options…')}</p>
            ) : (
              <ul className="grid grid-cols-4 gap-x-2 gap-y-3">
                {optionSet.groups.map((g) => {
                  const option = g.options.find((o) => o.code === brief.picks[g.id]);
                  return (
                    <li key={g.id} style={{ '--tone': g.tone } as React.CSSProperties}>
                      <button type="button" onClick={() => setOpenGroup(g.id)} aria-haspopup="dialog" className="w-full flex flex-col items-center gap-1.5 text-center min-w-0">
                        <span className={cn('tone-circle w-16 h-16 lg:w-[4.5rem] lg:h-[4.5rem] rounded-full grid place-items-center overflow-hidden', option && 'is-chosen', openGroup === g.id && 'is-open')}>
                          {option ? <OptionVisual group={g} option={option} round /> : <GroupIcon icon={g.icon} size={26} />}
                        </span>
                        <span className="text-sm font-semibold text-slate-100 truncate max-w-full">{t(g.label)}</span>
                        <span className={cn('text-[11px] truncate max-w-full', option ? 'text-[var(--tone)]' : 'text-slate-500')}>{option ? t(option.label) : t('None')}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex items-center justify-between gap-2 min-h-9">
              <span className="text-xs text-slate-500">{chosen.length ? tp(chosen.length, 'option chosen', 'options chosen') : t('Tap a circle to choose from the thumbnails.')}</span>
              {chosen.length > 0 && (
                <button type="button" onClick={() => update({ picks: {} })} className="h-9 px-3 rounded-lg text-xs font-semibold text-slate-300 flex items-center gap-1.5 active:bg-white/10">
                  <Eraser size={14} /> {t('Clear')}
                </button>
              )}
            </div>
            {chosen.length > 0 && (
              <ul className="flex flex-wrap gap-1.5 min-h-0 overflow-hidden">
                {chosen.map(({ group, option }) => (
                  <li key={group.id} style={{ '--tone': group.tone } as React.CSSProperties} className="h-9 pl-1 pr-1 rounded-full border border-white/15 bg-white/5 text-xs text-slate-100 flex items-center gap-1.5 max-w-full">
                    <span className="w-7 h-7 rounded-full overflow-hidden shrink-0"><OptionVisual group={group} option={option} round /></span>
                    <span className="truncate">{t(option.label)}</span>
                    <button type="button" onClick={() => pick(group.id, '')} aria-label={t('Remove {name}', { name: t(option.label) })} className="w-7 h-7 rounded-full grid place-items-center text-slate-400 active:bg-white/10 shrink-0">
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {flagged && (
              <p className="text-sm text-amber-200 flex items-start gap-2">
                <ShieldAlert size={16} className="shrink-0 mt-0.5" /> {t('On hold: a symbol in this design belongs to a closed or sacred tradition. Resolve it with {name} first.', { name: APP.assistantName })}
              </p>
            )}
          </section>
        </div>

        <aside className="md:w-[25rem] shrink-0 flex flex-col gap-3 min-h-0">
          <section className="panel p-3 space-y-3 shrink-0">
            <div className="grid grid-cols-3 gap-1.5" role="tablist" aria-label={t('What to make')}>
              {KINDS.map((k) => {
                const Icon = KIND_INFO[k].icon;
                const available = kindAvailable(k);
                return (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={kind === k}
                    onClick={() => setKind(k)}
                    className={cn('min-h-16 rounded-xl border px-2 py-2 flex flex-col items-center justify-center gap-1 text-xs', kind === k ? 'border-pink-400/60 bg-pink-400/10 text-pink-100' : 'border-white/10 text-slate-300', !available && 'opacity-40')}
                  >
                    <Icon size={18} />
                    <span className="leading-tight text-center">{t(KIND_INFO[k].label)}</span>
                    {!isAdmin && <span className="font-mono text-[10px] text-slate-400">{available ? t('{n} left', { n: left(k) }) : t('not in package')}</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400">{t(KIND_INFO[kind].note)}</p>
            {estimate?.usesReference && kind === 'mannequin' && (
              <p className="text-xs text-sky-200 flex items-start gap-1.5"><Info size={14} className="shrink-0 mt-0.5" /> {t('Uses your latest design as the reference, so the preview shows the same tattoo.')}</p>
            )}
            {estimate?.warnings.map((w) => (
              <p key={w.code} className="text-xs text-amber-200 flex items-start gap-1.5"><AlertTriangle size={14} className="shrink-0 mt-0.5" /> {warningText(w, t)}</p>
            ))}
            {estimate?.blocker && !running && <p className="text-xs text-rose-300 flex items-start gap-1.5"><AlertTriangle size={14} className="shrink-0 mt-0.5" /> {t(estimate.blocker)}</p>}
            {running ? (
              <div className="h-14 rounded-xl border border-pink-400/40 bg-pink-400/10 px-4 flex items-center gap-3 text-sm text-pink-100">
                <Loader2 size={18} className="animate-spin shrink-0" />
                <span className="flex-1 truncate">{running}</span>
                <button type="button" onClick={() => controller.current?.abort()} className="h-10 px-3 rounded-lg border border-white/15 text-xs">{t('Stop')}</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={generate}
                disabled={!project || !saved || !estimate || Boolean(estimate.blocker) || estimating}
                className="w-full h-14 rounded-xl bg-pink-400 text-black font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-40 active:bg-pink-300"
              >
                {estimating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />} {project ? buttonLabel() : t('Describe the motif to begin')}
              </button>
            )}
            {isAdmin && estimate?.model && <p className="text-[11px] font-mono text-slate-500">{estimate.model.label} · {estimate.aspect}</p>}
            {error && <p className="text-xs text-rose-300 flex items-start gap-1.5"><AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}</p>}
            {!saved && <p className="text-[11px] font-mono text-slate-500 flex items-center gap-1"><Save size={12} /> {t('Saving…')}</p>}
          </section>

          <section className="panel p-3 flex-1 min-h-0 flex flex-col gap-2">
            <span className="field-label mb-0">{t('Pictures of this design')} ({images.length})</span>
            {images.length === 0 ? (
              <p className="text-xs text-slate-500">{t('Nothing yet. Pictures appear here and in My designs.')}</p>
            ) : (
              <ul className="grid grid-cols-3 gap-2 min-h-0 overflow-hidden content-start">
                {images.slice(0, 9).map((img) => (
                  <li key={img.id}>
                    <button type="button" onClick={() => setZoom(img)} aria-label={t(KIND_INFO[img.kind].label)} className="block w-full aspect-square rounded-xl overflow-hidden border border-white/10">
                      <DesignThumb projectId={project!.id} image={img} className="block w-full h-full" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {images.length > 9 && (
              <button type="button" onClick={() => navigate('projects')} className="h-10 self-start px-3 rounded-lg text-xs text-violet-300">{t('All pictures in My designs')}</button>
            )}
          </section>
        </aside>

        {optionSet && <OptionWindow set={optionSet} groupId={openGroup} picks={brief.picks} onPick={pick} onGroupChange={setOpenGroup} onClose={() => setOpenGroup(null)} />}
        {project && <ImageSheet projectId={project.id} image={zoom} onClose={() => setZoom(null)} />}
        {isAdmin && optionSet && <SamplesSheet open={samplesOpen} set={optionSet} onClose={() => setSamplesOpen(false)} onUpdated={setOptionSet} onOpenSettings={openSettings} />}
      </ViewBody>
    </>
  );
}

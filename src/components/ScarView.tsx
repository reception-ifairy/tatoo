import React from 'react';
import { Bandage, Plus, ShieldCheck, Upload, Trash2, Loader2, AlertTriangle, Sparkles, CheckCircle2, Lock } from 'lucide-react';
import type { DesignBrief, DesignImage, GenerationEstimate, Project, ProjectSummary } from '../design';
import type { OutputKind } from '../account';
import { formatUsd } from '../imageModels';
import { useI18n } from '../i18n';
import { getSection } from '../lib/sections';
import { useApp } from '../lib/appContext';
import { api } from '../lib/appApi';
import { cn } from '../lib/utils';
import ViewHeader, { ViewBody, HeaderButton } from './shell/ViewHeader';
import OptionWindow from './options/OptionWindow';
import OptionVisual, { GroupIcon } from './options/OptionVisual';
import PhotoCropper from './design/PhotoCropper';
import ImageSheet, { DesignThumb } from './design/ImageSheet';
import { KIND_INFO } from './design/PackageCard';
import { warningText } from './GeneratorView';

// The private scar cover-up service — the only place where a client uploads a photo of their body.
// Consent first; the photo is cropped in the browser to the scar alone, re-encoded on the server without any
// metadata, kept only with this project and deleted (with every picture made from it) when the project is
// completed, or at any time with one button. In the admin's lists the project shows an anonymous alias.

const GROUPS = ['style', 'palette', 'line', 'mood'];
const KINDS: OutputKind[] = ['scar', 'stencil'];

export default function ScarView({ request }: { request: { projectId?: string; nonce: number } | null }) {
  const section = getSection('scar');
  const { t } = useI18n();
  const { user, optionSet, projectsVersion, projectsChanged, refreshUser } = useApp();
  const isAdmin = user.role === 'admin';
  const [list, setList] = React.useState<ProjectSummary[]>([]);
  const [project, setProject] = React.useState<Project | null>(null);
  const [brief, setBrief] = React.useState<DesignBrief | null>(null);
  const [saved, setSaved] = React.useState(true);
  const [consent, setConsent] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [openGroup, setOpenGroup] = React.useState<string | null>(null);
  const [kind, setKind] = React.useState<OutputKind>('scar');
  const [estimate, setEstimate] = React.useState<GenerationEstimate | null>(null);
  const [running, setRunning] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState<DesignImage | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const controller = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    api.projects().then((all) => setList(all.filter((p) => p.type === 'scar')), () => undefined);
  }, [projectsVersion]);

  const show = React.useCallback(async (id: string) => {
    setError(null);
    setFile(null);
    try {
      const p = await api.project(id);
      setProject(p);
      setBrief(p.brief);
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  React.useEffect(() => {
    if (request?.projectId) show(request.projectId);
  }, [request?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    setError(null);
    try {
      const p = await api.createProject({ type: 'scar' });
      setProject(p);
      setBrief(p.brief);
      setConsent(false);
      projectsChanged();
    } catch (err: any) {
      setError(err.message);
    }
  };

  React.useEffect(() => {
    if (saved || !project || !brief) return;
    const timer = setTimeout(() => {
      api.patchProject(project.id, { brief }).then((p) => { setProject(p); setSaved(true); }, (err) => setError(err.message));
    }, 700);
    return () => clearTimeout(timer);
  }, [brief, saved, project]);

  React.useEffect(() => {
    if (!project || !saved || !project.photo) return setEstimate(null);
    let live = true;
    api.estimate(project.id, kind).then((e) => live && setEstimate(e), (err) => live && setError(err.message));
    return () => { live = false; };
  }, [project?.id, project?.updatedAt, project?.photo, kind, saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (blob: Blob) => {
    if (!project) return;
    setUploading(true);
    setError(null);
    try {
      setProject(await api.uploadPhoto(project.id, blob));
      setFile(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async () => {
    if (!project || !window.confirm(t('Delete the photo and every picture made from it?'))) return;
    try {
      setProject(await api.deletePhoto(project.id));
      projectsChanged();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const complete = async () => {
    if (!project || !window.confirm(t('Completing deletes the scar photo and every picture made from it. Continue?'))) return;
    try {
      setProject(await api.patchProject(project.id, { status: 'done' }));
      projectsChanged();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const generate = async () => {
    if (!project || !estimate || estimate.blocker) return;
    setError(null);
    setRunning(t('Starting…'));
    const c = new AbortController();
    controller.current = c;
    try {
      const r = await api.generate(project.id, kind, isAdmin ? estimate.costUsd : null, (e) => e.type === 'status' && setRunning(e.message), c.signal);
      setProject(r.project);
      setZoom(r.image);
      projectsChanged();
      refreshUser();
    } catch (err: any) {
      if (err?.name !== 'AbortError') setError(err.message);
    } finally {
      setRunning(null);
    }
  };

  const groups = optionSet ? optionSet.groups.filter((g) => GROUPS.includes(g.id)) : [];
  const subset = optionSet ? { ...optionSet, groups } : null;
  const pick = (groupId: string, code: string) => {
    if (!brief) return;
    setBrief({ ...brief, picks: { ...brief.picks, [groupId]: code } });
    setSaved(false);
  };
  const done = project?.status === 'done';

  return (
    <>
      <ViewHeader section={section}>
        <HeaderButton tone="primary" onClick={create}>
          <Plus size={18} /> <span className="hidden sm:inline">{t('New cover-up')}</span>
        </HeaderButton>
      </ViewHeader>
      <ViewBody className="flex flex-col md:flex-row gap-4">
        <aside className="md:w-64 shrink-0 panel p-3 flex flex-col gap-2 min-h-0">
          <p className="field-label">{t('Your cover-ups')}</p>
          {list.length === 0 && <p className="text-xs text-slate-500">{t('None yet.')}</p>}
          <ul className="flex flex-col gap-1 min-h-0 overflow-hidden">
            {list.slice(0, 8).map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => show(p.id)} className={cn('w-full min-h-12 px-3 py-2 rounded-xl border text-left text-sm', project?.id === p.id ? 'border-rose-400/50 bg-rose-400/10' : 'border-transparent active:bg-white/5')}>
                  <span className="block truncate text-slate-100">{p.title}</span>
                  <span className="block text-[11px] font-mono text-slate-500">{p.status === 'done' ? t('Completed') : t('Open')}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-auto p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-400 space-y-1.5">
            <p className="flex items-center gap-1.5 text-slate-200 font-semibold"><Lock size={14} className="text-rose-300" /> {t('How your photo is kept')}</p>
            <p>{t('Cropped to the scar in your browser, stored without any metadata (no location, no camera data), seen by nobody else but the studio admin, and deleted when you complete the project.')}</p>
          </div>
        </aside>

        <section className="flex-1 min-w-0 min-h-0 flex flex-col gap-3">
          {!project ? (
            <div className="panel p-6 max-w-xl space-y-3">
              <Bandage size={32} className="text-rose-300" />
              <h3 className="font-display text-xl text-white">{t('A private cover-up for a scar')}</h3>
              <p className="text-sm text-slate-300">{t('Upload a close, cropped photo of the healed scar and get a cover-up design drawn over it, plus a line stencil for your artist. A scar needs to be fully healed (often a year or more) and assessed by a professional before it is tattooed.')}</p>
              <button type="button" onClick={create} className="h-12 px-5 rounded-xl bg-rose-400 text-black font-semibold text-sm flex items-center gap-2"><Plus size={16} /> {t('Start a cover-up')}</button>
            </div>
          ) : !project.photo && !done ? (
            <div className="panel p-4 flex-1 min-h-0 overflow-y-auto space-y-3">
              {file ? (
                <PhotoCropper file={file} busy={uploading} onCropped={upload} onCancel={() => setFile(null)} />
              ) : (
                <>
                  <h3 className="font-display text-lg text-white flex items-center gap-2"><ShieldCheck size={20} className="text-rose-300" /> {t('Before you add the photo')}</h3>
                  <ul className="text-sm text-slate-300 list-disc pl-5 space-y-1">
                    <li>{t('Only the scar and a little skin around it. You will crop it in the next step.')}</li>
                    <li>{t('No faces, no intimate areas, no photos of anyone else.')}</li>
                    <li>{t('The photo is used only for your cover-up designs and is deleted when you complete the project — or right away with one button.')}</li>
                  </ul>
                  <label className="flex items-start gap-3 min-h-12 text-sm text-slate-200">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="w-6 h-6 mt-0.5 accent-rose-400" />
                    <span>{t('I agree that this photo of my own skin is stored with this project and sent to the image model to draw the cover-up.')}</span>
                  </label>
                  {!isAdmin && project.ownerId !== user.id ? null : (
                    <button type="button" disabled={!consent} onClick={() => fileRef.current?.click()} className="h-12 px-5 rounded-xl bg-rose-400 text-black font-semibold text-sm flex items-center gap-2 disabled:opacity-40">
                      <Upload size={16} /> {t('Choose a photo')}
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); e.target.value = ''; }} />
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3">
              <div className="panel p-3 flex-1 min-w-0 min-h-0 flex flex-col gap-3">
                <div className="flex gap-3 items-start">
                  {project.photo ? (
                    <img src={`/api/projects/${project.id}/photo?v=${project.photo.uploadedAt}`} alt={t('Your cropped scar photo')} className="w-28 h-28 rounded-xl object-cover border border-white/10 shrink-0" />
                  ) : (
                    <span className="w-28 h-28 rounded-xl border border-dashed border-white/15 grid place-items-center text-xs text-slate-500 text-center p-2 shrink-0">{t('Photo deleted')}</span>
                  )}
                  <div className="flex-1 min-w-0 space-y-2">
                    <label htmlFor="scar-subject" className="field-label">{t('What should the cover-up show?')}</label>
                    <input
                      id="scar-subject"
                      value={brief?.subject ?? ''}
                      disabled={done}
                      maxLength={400}
                      onChange={(e) => { if (brief) { setBrief({ ...brief, subject: e.target.value }); setSaved(false); } }}
                      placeholder={t('e.g. a branch of cherry blossom following the line of the scar')}
                      className="field h-12"
                    />
                    {project.photo && !done && (
                      <button type="button" onClick={deletePhoto} className="h-10 px-3 rounded-lg border border-rose-400/40 text-rose-300 text-xs flex items-center gap-1.5"><Trash2 size={14} /> {t('Delete the photo now')}</button>
                    )}
                  </div>
                </div>
                <ul className="grid grid-cols-4 gap-2">
                  {groups.map((g) => {
                    const option = g.options.find((o) => o.code === brief?.picks[g.id]);
                    return (
                      <li key={g.id} style={{ '--tone': g.tone } as React.CSSProperties}>
                        <button type="button" disabled={done} onClick={() => setOpenGroup(g.id)} className="w-full flex flex-col items-center gap-1 text-center min-w-0">
                          <span className={cn('tone-circle w-14 h-14 rounded-full grid place-items-center overflow-hidden', option && 'is-chosen')}>
                            {option ? <OptionVisual group={g} option={option} round /> : <GroupIcon icon={g.icon} size={22} />}
                          </span>
                          <span className="text-xs font-semibold text-slate-100 truncate max-w-full">{t(g.label)}</span>
                          <span className="text-[11px] text-slate-500 truncate max-w-full">{option ? t(option.label) : t('None')}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="grid grid-cols-3 gap-2 min-h-0 overflow-hidden content-start">
                  {[...project.images].reverse().slice(0, 6).map((img) => (
                    <button key={img.id} type="button" onClick={() => setZoom(img)} className="aspect-square rounded-xl overflow-hidden border border-white/10">
                      <DesignThumb projectId={project.id} image={img} className="block w-full h-full" />
                    </button>
                  ))}
                </div>
              </div>

              <aside className="panel p-3 lg:w-80 shrink-0 space-y-3">
                {done ? (
                  <p className="text-sm text-emerald-200 flex items-start gap-2"><CheckCircle2 size={16} className="shrink-0 mt-0.5" /> {t('Completed. The photo and every picture made from it are deleted.')}</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-1.5">
                      {KINDS.map((k) => (
                        <button key={k} type="button" onClick={() => setKind(k)} className={cn('min-h-14 rounded-xl border px-2 text-xs', kind === k ? 'border-rose-400/60 bg-rose-400/10 text-rose-100' : 'border-white/10 text-slate-300')}>
                          {k === 'scar' ? t('Cover-up on the photo') : t(KIND_INFO.stencil.label)}
                        </button>
                      ))}
                    </div>
                    {estimate?.warnings.map((w) => <p key={w.code} className="text-xs text-amber-200 flex gap-1.5"><AlertTriangle size={14} className="shrink-0" /> {warningText(w, t)}</p>)}
                    {estimate?.blocker && <p className="text-xs text-rose-300 flex gap-1.5"><AlertTriangle size={14} className="shrink-0" /> {t(estimate.blocker)}</p>}
                    {running ? (
                      <div className="h-14 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 flex items-center gap-3 text-sm text-rose-100"><Loader2 size={18} className="animate-spin" /> <span className="truncate">{running}</span></div>
                    ) : (
                      <button type="button" onClick={generate} disabled={!estimate || Boolean(estimate.blocker) || !saved} className="w-full h-14 rounded-xl bg-rose-400 text-black font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40">
                        <Sparkles size={18} />
                        {estimate ? (isAdmin ? t('Make · {cost}', { cost: formatUsd(estimate.costUsd ?? 0) }) : t('Make · {left} left', { left: estimate.remaining ?? 0 })) : t('Make')}
                      </button>
                    )}
                    <button type="button" onClick={complete} className="w-full h-12 rounded-xl border border-emerald-400/40 text-emerald-200 text-sm flex items-center justify-center gap-2"><CheckCircle2 size={16} /> {t('Complete the project (deletes the photo)')}</button>
                  </>
                )}
                {error && <p className="text-xs text-rose-300">{error}</p>}
              </aside>
            </div>
          )}
          {!project && error && <p className="text-sm text-rose-300">{error}</p>}
        </section>

        {subset && brief && <OptionWindow set={subset} groupId={openGroup} picks={brief.picks} onPick={pick} onGroupChange={setOpenGroup} onClose={() => setOpenGroup(null)} />}
        {project && <ImageSheet projectId={project.id} image={zoom} onClose={() => setZoom(null)} />}
      </ViewBody>
    </>
  );
}

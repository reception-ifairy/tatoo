import React from 'react';
import { Images, Wand2, Trash2, CheckCircle2, RotateCcw, Loader2, Bandage, ScrollText, Copy, Check, ImageOff } from 'lucide-react';
import type { DesignImage, Project, ProjectSummary } from '../design';
import { useI18n } from '../i18n';
import { getSection } from '../lib/sections';
import { useApp } from '../lib/appContext';
import { api } from '../lib/appApi';
import { cn } from '../lib/utils';
import ViewHeader, { ViewBody, HeaderButton } from './shell/ViewHeader';
import Pager from './ui/Pager';
import Sheet from './ui/Sheet';
import BriefChips from './design/BriefChips';
import ImageSheet, { DesignThumb } from './design/ImageSheet';
import { KIND_INFO } from './design/PackageCard';

// Every design of the user (the admin can also see everyone's; scar projects show an anonymous alias there).

export default function ProjectsView() {
  const section = getSection('projects');
  const { t, tp, locale } = useI18n();
  const { user, projectsVersion, projectsChanged, openGenerator, openScar, optionSet } = useApp();
  const isAdmin = user.role === 'admin';
  const [all, setAll] = React.useState(false);
  const [items, setItems] = React.useState<ProjectSummary[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState<Project | null>(null);
  const [zoom, setZoom] = React.useState<DesignImage | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    api.projects(all).then(setItems, (err) => setError(err.message));
  }, [all, projectsVersion]);

  const show = async (id: string) => {
    setConfirmDelete(false);
    try {
      setOpen(await api.project(id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const setStatus = async (status: 'open' | 'done') => {
    if (!open) return;
    if (status === 'done' && open.type === 'scar' && open.photo && !window.confirm(t('Completing deletes the scar photo and every picture made from it. Continue?'))) return;
    setBusy(true);
    try {
      setOpen(await api.patchProject(open.id, { status }));
      projectsChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!open) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    try {
      await api.deleteProject(open.id);
      setOpen(null);
      projectsChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <>
      <ViewHeader section={section}>
        {isAdmin && (
          <div className="flex rounded-xl border border-white/10 overflow-hidden" role="tablist">
            {[false, true].map((v) => (
              <button key={String(v)} type="button" role="tab" aria-selected={all === v} onClick={() => setAll(v)} className={cn('h-12 px-4 text-sm', all === v ? 'bg-violet-400/15 text-violet-200' : 'text-slate-400')}>
                {v ? t('Everyone') : t('Mine')}
              </button>
            ))}
          </div>
        )}
        <HeaderButton tone="primary" onClick={() => openGenerator({})}>
          <Wand2 size={18} /> <span className="hidden sm:inline">{t('Generator')}</span>
        </HeaderButton>
      </ViewHeader>
      <ViewBody className="flex flex-col">
        {error && <p className="text-sm text-rose-300 mb-2">{error}</p>}
        {!items ? (
          <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> {t('Loading…')}</p>
        ) : items.length === 0 ? (
          <div className="panel p-6 text-center space-y-3 max-w-lg mx-auto mt-8">
            <Images size={32} className="mx-auto text-violet-300" />
            <p className="text-slate-300">{t('No designs yet. Start a consultation or open the generator.')}</p>
          </div>
        ) : (
          <Pager
            items={items}
            getKey={(p) => p.id}
            minItemWidth={220}
            itemHeight={250}
            label={t('Designs')}
            className="flex-1 min-h-0"
            renderItem={(p) => (
              <button type="button" onClick={() => show(p.id)} className="panel w-full h-full overflow-hidden flex flex-col text-left active:border-violet-400/50">
                <span className="flex-1 min-h-0 bg-black grid place-items-center">
                  {p.cover ? <img src={p.cover} alt="" loading="lazy" className="w-full h-full object-contain" /> : p.type === 'scar' ? <Bandage size={32} className="text-rose-300" /> : <ImageOff size={28} className="text-slate-600" />}
                </span>
                <span className="p-3 shrink-0">
                  <span className="block text-sm font-semibold text-white truncate">{p.title}</span>
                  <span className="block text-[11px] font-mono text-slate-500 truncate">
                    {p.owner ? `${p.owner} · ` : ''}{tp(p.imageCount, 'picture', 'pictures')} · {date(p.updatedAt)}
                  </span>
                  <span className="mt-1 flex gap-1.5">
                    {p.type === 'scar' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-400/15 text-rose-200">{t('Scar cover-up')}</span>}
                    {p.status === 'done' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-200">{t('Completed')}</span>}
                  </span>
                </span>
              </button>
            )}
          />
        )}
      </ViewBody>

      <Sheet open={Boolean(open)} onClose={() => setOpen(null)} title={open?.title ?? ''} icon={open?.type === 'scar' ? Bandage : Images} tone={section.tone} widthClass="max-w-3xl">
        {open && (
          <div className="space-y-4">
            {open.brief.subject && <p className="text-base text-slate-100">{open.brief.subject}</p>}
            <BriefChips brief={open.brief} set={optionSet} />
            {open.images.length > 0 ? (
              <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {[...open.images].reverse().map((img) => (
                  <li key={img.id}>
                    <button type="button" onClick={() => setZoom(img)} className="block w-full aspect-square rounded-xl overflow-hidden border border-white/10 relative">
                      <DesignThumb projectId={open.id} image={img} className="block w-full h-full" />
                      <span className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/70 text-slate-200">{t(KIND_INFO[img.kind].label)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">{t('No pictures yet.')}</p>
            )}
            {open.studioBrief && (
              <div className="p-3 rounded-xl border border-emerald-400/30 bg-emerald-400/[0.05] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-emerald-200 flex items-center gap-2"><ScrollText size={16} /> {t('Studio brief')}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(open.studioBrief!).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
                    className="h-9 px-3 rounded-lg text-xs text-slate-300 flex items-center gap-1.5"
                  >
                    {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />} {copied ? t('Copied') : t('Copy')}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-slate-200 font-sans">{open.studioBrief}</pre>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              {open.type === 'design' ? (
                <button type="button" onClick={() => { const id = open.id; setOpen(null); openGenerator({ projectId: id }); }} className="h-12 px-4 rounded-xl bg-pink-400 text-black font-semibold text-sm flex items-center gap-2">
                  <Wand2 size={16} /> {t('Open in generator')}
                </button>
              ) : (
                <button type="button" onClick={() => { const id = open.id; setOpen(null); openScar(id); }} className="h-12 px-4 rounded-xl bg-rose-400 text-black font-semibold text-sm flex items-center gap-2">
                  <Bandage size={16} /> {t('Open the cover-up')}
                </button>
              )}
              {open.status === 'open' ? (
                <button type="button" disabled={busy} onClick={() => setStatus('done')} className="h-12 px-4 rounded-xl border border-emerald-400/40 text-emerald-200 text-sm flex items-center gap-2">
                  <CheckCircle2 size={16} /> {t('Mark as completed')}
                </button>
              ) : (
                <button type="button" disabled={busy} onClick={() => setStatus('open')} className="h-12 px-4 rounded-xl border border-white/10 text-slate-200 text-sm flex items-center gap-2">
                  <RotateCcw size={16} /> {t('Reopen')}
                </button>
              )}
              <button type="button" disabled={busy} onClick={remove} className={cn('h-12 px-4 rounded-xl text-sm flex items-center gap-2', confirmDelete ? 'bg-rose-500 text-white' : 'border border-rose-400/40 text-rose-300')}>
                <Trash2 size={16} /> {confirmDelete ? t('Delete for good') : t('Delete')}
              </button>
            </div>
          </div>
        )}
      </Sheet>
      {open && <ImageSheet projectId={open.id} image={zoom} onClose={() => setZoom(null)} />}
    </>
  );
}

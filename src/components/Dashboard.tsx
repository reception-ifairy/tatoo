import React from 'react';
import { MessagesSquare, Wand2, BookOpen, Bandage, Users, Settings, ImageOff, ArrowRight } from 'lucide-react';
import type { ProjectSummary } from '../design';
import { APP } from '../config';
import { useI18n } from '../i18n';
import { getSection } from '../lib/sections';
import { useApp } from '../lib/appContext';
import { useOptionalAiSettings } from '../lib/aiSettingsContext';
import { api } from '../lib/appApi';
import { canConsult, hasScarService } from '../account';
import ViewHeader, { ViewBody } from './shell/ViewHeader';
import PackageCard from './design/PackageCard';

// The studio: a greeting, where to start, the package (clients) or the studio's state (admin), recent designs.

export default function Dashboard() {
  const section = getSection('studio');
  const { t, locale } = useI18n();
  const { user, navigate, startChat, openGenerator, projectsVersion, openSettings } = useApp();
  const ai = useOptionalAiSettings();
  const isAdmin = user.role === 'admin';
  const [recent, setRecent] = React.useState<ProjectSummary[]>([]);
  const [clientCount, setClientCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    api.projects().then((p) => setRecent(p.slice(0, 4)), () => undefined);
  }, [projectsVersion]);
  React.useEffect(() => {
    if (isAdmin) api.clients().then((c) => setClientCount(c.length), () => undefined);
  }, [isAdmin]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('Good morning') : hour < 18 ? t('Good afternoon') : t('Good evening');

  const actions = [
    canConsult(user) && { icon: MessagesSquare, tone: 'text-amber-300 bg-amber-400/10 border-amber-400/30', title: t('Start a consultation'), text: t('Begin with a feeling, not a picture. {name} guides you to a design.', { name: APP.assistantName }), onClick: () => navigate('consult') },
    { icon: Wand2, tone: 'text-pink-300 bg-pink-400/10 border-pink-400/30', title: t('Open the generator'), text: t('Choose style, placement and palette, then make a stencil, a colour design or a mannequin preview.'), onClick: () => openGenerator({}) },
    { icon: BookOpen, tone: 'text-sky-300 bg-sky-400/10 border-sky-400/30', title: t('Explore the atlas'), text: t('Every style and technique, with history and how it ages.'), onClick: () => navigate('atlas') },
    hasScarService(user) && { icon: Bandage, tone: 'text-rose-300 bg-rose-400/10 border-rose-400/30', title: t('Scar cover-up'), text: t('Private and anonymous, from a cropped photo of the scar.'), onClick: () => navigate('scar') },
  ].filter(Boolean) as { icon: typeof Wand2; tone: string; title: string; text: string; onClick: () => void }[];

  return (
    <>
      <ViewHeader section={section} subtitle={`${greeting}, ${user.displayName}.`} />
      <ViewBody className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-4">
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
            {actions.map((a) => (
              <button key={a.title} type="button" onClick={a.onClick} className={`rounded-2xl border p-4 text-left flex gap-3 items-start min-h-28 ${a.tone}`}>
                <a.icon size={26} className="shrink-0" />
                <span className="min-w-0">
                  <span className="block font-display font-semibold text-white text-lg">{a.title}</span>
                  <span className="block text-sm text-slate-400">{a.text}</span>
                </span>
              </button>
            ))}
          </section>
          {canConsult(user) && (
            <section className="panel p-3 shrink-0 flex flex-wrap gap-2 items-center">
              <span className="text-xs text-slate-500 mr-1">{t('Or ask straight away:')}</span>
              {['I want a tattoo to close an important chapter', 'Which styles age best?'].map((q) => (
                <button key={q} type="button" onClick={() => startChat(t(q))} className="h-10 px-3 rounded-full border border-amber-400/30 text-amber-100 bg-amber-500/10 text-sm">{t(q)}</button>
              ))}
            </section>
          )}
          <section className="panel p-3 flex-1 min-h-0 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="field-label mb-0">{t('Recent designs')}</span>
              <button type="button" onClick={() => navigate('projects')} className="h-9 px-3 rounded-lg text-xs text-violet-300 flex items-center gap-1">{t('All')} <ArrowRight size={14} /></button>
            </div>
            {recent.length === 0 ? (
              <p className="text-sm text-slate-500">{t('Your designs will appear here.')}</p>
            ) : (
              <ul className="grid grid-cols-2 xl:grid-cols-4 gap-2 flex-1 min-h-0">
                {recent.map((p) => (
                  <li key={p.id} className="min-h-0">
                    <button type="button" onClick={() => (p.type === 'scar' ? navigate('scar') : openGenerator({ projectId: p.id }))} className="w-full h-full min-h-28 rounded-xl border border-white/10 overflow-hidden flex flex-col text-left">
                      <span className="flex-1 min-h-0 bg-black grid place-items-center">
                        {p.cover ? <img src={p.cover} alt="" className="w-full h-full object-contain" /> : <ImageOff size={22} className="text-slate-600" />}
                      </span>
                      <span className="p-2 shrink-0">
                        <span className="block text-sm text-white truncate">{p.title}</span>
                        <span className="block text-[11px] font-mono text-slate-500">{new Date(p.updatedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="lg:w-[26rem] shrink-0 min-h-0 flex flex-col gap-3">
          {isAdmin ? (
            <>
              <section className="panel p-4 space-y-2">
                <p className="text-xs font-mono uppercase tracking-wider text-orange-300">{t('Studio admin')}</p>
                <p className="text-sm text-slate-300">{clientCount === null ? '…' : t('{n} client accounts', { n: clientCount })}</p>
                <p className={`text-sm ${ai?.engineReady ? 'text-emerald-300' : 'text-amber-300'}`}>{ai?.engineReady ? t('AI engine ready') : t('The AI engine has no key yet')}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="button" onClick={() => navigate('clients')} className="h-11 px-3 rounded-xl border border-cyan-400/40 text-cyan-200 text-sm flex items-center gap-2"><Users size={16} /> {t('Clients & packages')}</button>
                  <button type="button" onClick={openSettings} className="h-11 px-3 rounded-xl border border-violet-400/40 text-violet-200 text-sm flex items-center gap-2"><Settings size={16} /> {t('Settings')}</button>
                </div>
              </section>
              <p className="text-xs text-slate-500 px-1">{t('Your own pictures are never limited; each one shows its price before you start.')}</p>
            </>
          ) : (
            <PackageCard pkg={user.package} usage={user.usage} compact />
          )}
        </aside>
      </ViewBody>
    </>
  );
}

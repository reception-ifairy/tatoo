import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Landmark, Clock3, Loader2, ExternalLink, BookOpenText } from 'lucide-react';
import type { Article } from '../compendium';
import { useI18n } from '../i18n';
import { getSection } from '../lib/sections';
import { useApp } from '../lib/appContext';
import { api } from '../lib/appApi';
import { cn, safeUrl } from '../lib/utils';
import ViewHeader, { ViewBody } from './shell/ViewHeader';
import Pager from './ui/Pager';
import Sheet from './ui/Sheet';

// History & library: the timeline of marks on skin, four anthropological lenses, and the 30 research articles.
// The articles stay in English for everyone.

type Tab = 'history' | 'library';

export default function LibraryView() {
  const section = getSection('library');
  const { t } = useI18n();
  const { compendium } = useApp();
  const [tab, setTab] = React.useState<Tab>('history');
  const [module, setModule] = React.useState('all');
  const [reading, setReading] = React.useState<{ article: Article; body: string | null; error?: string } | null>(null);

  const openArticle = (article: Article) => {
    setReading({ article, body: null });
    api.article(article.slug).then(
      (r) => setReading({ article, body: r.body }),
      (err) => setReading({ article, body: null, error: err.message }),
    );
  };

  if (!compendium) {
    return (
      <>
        <ViewHeader section={section} />
        <ViewBody><p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> {t('Loading…')}</p></ViewBody>
      </>
    );
  }
  const periods = [...compendium.history.periods].sort((a, b) => a.displayOrder - b.displayOrder);
  const lenses = [...compendium.history.anthropologyLenses].sort((a, b) => a.displayOrder - b.displayOrder);
  const modules = [...new Set(compendium.articles.map((a) => a.module))];
  const articles = [...compendium.articles].filter((a) => module === 'all' || a.module === module).sort((a, b) => a.module.localeCompare(b.module) || a.order - b.order);

  return (
    <>
      <ViewHeader section={section}>
        <div className="flex rounded-xl border border-white/10 overflow-hidden" role="tablist">
          {(['history', 'library'] as Tab[]).map((x) => (
            <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => setTab(x)} className={cn('h-12 px-4 text-sm', tab === x ? 'bg-emerald-400/15 text-emerald-200' : 'text-slate-400')}>
              {x === 'history' ? t('History') : t('Library')}
            </button>
          ))}
        </div>
      </ViewHeader>
      <ViewBody className="flex flex-col gap-3">
        {tab === 'history' ? (
          <>
            <Pager
              items={periods}
              getKey={(p) => p.id}
              minItemWidth={300}
              itemHeight={210}
              label={t('Periods')}
              className="flex-1 min-h-0"
              renderItem={(p) => {
                const href = safeUrl(p.sourceUrl);
                return (
                  <article className="panel w-full h-full p-4 flex flex-col gap-1.5 overflow-hidden">
                    <span className="text-xs font-mono text-emerald-300 flex items-center gap-1.5"><Clock3 size={13} /> {p.dateLabel}</span>
                    <h3 className="font-display font-semibold text-white">{p.title}</h3>
                    <p className="text-sm text-slate-400 line-clamp-4 flex-1">{p.summary}</p>
                    {href && (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-300 flex items-center gap-1 truncate min-h-8">
                        <ExternalLink size={12} /> {p.sourceLabel}
                      </a>
                    )}
                  </article>
                );
              }}
            />
            <section className="shrink-0">
              <h3 className="field-label">{t('Four lenses for every style')}</h3>
              <ul className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {lenses.map((l) => (
                  <li key={l.id} className="panel p-3">
                    <p className="text-sm font-semibold text-white flex items-center gap-2"><Landmark size={15} className="text-emerald-300" /> {l.title}</p>
                    <p className="text-xs text-slate-400 line-clamp-3 mt-1">{l.description}</p>
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : (
          <>
            <div className="flex gap-1.5 overflow-x-auto shrink-0 pb-1">
              {['all', ...modules].map((m) => (
                <button key={m} type="button" onClick={() => setModule(m)} className={cn('h-10 px-3 rounded-full border text-xs whitespace-nowrap capitalize', module === m ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-100' : 'border-white/10 text-slate-400')}>
                  {m === 'all' ? t('All') : m}
                </button>
              ))}
            </div>
            <Pager
              items={articles}
              getKey={(a) => a.id}
              minItemWidth={300}
              itemHeight={190}
              label={t('Articles')}
              className="flex-1 min-h-0"
              resetKey={module}
              renderItem={(a) => (
                <button type="button" onClick={() => openArticle(a)} className="panel w-full h-full p-4 text-left flex flex-col gap-1.5 overflow-hidden active:border-emerald-400/50">
                  <span className="text-[11px] font-mono text-emerald-300">{a.id} · {t('{n} min read', { n: a.readingMinutes })}</span>
                  <span className="font-display font-semibold text-white line-clamp-2">{a.title}</span>
                  <span className="text-sm text-slate-400 line-clamp-3">{a.dek}</span>
                </button>
              )}
            />
          </>
        )}
      </ViewBody>

      <Sheet open={Boolean(reading)} onClose={() => setReading(null)} title={reading?.article.title ?? ''} icon={BookOpenText} tone={section.tone} widthClass="max-w-4xl">
        {reading && (
          <div className="space-y-3">
            <p className="text-sm italic text-emerald-200">{reading.article.curatorNote}</p>
            {reading.error ? (
              <p className="text-sm text-rose-300">{reading.error}</p>
            ) : reading.body === null ? (
              <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> {t('Loading…')}</p>
            ) : (
              <div className="markdown-body text-base leading-relaxed" lang="en">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{ a: ({ href, children }) => { const s = safeUrl(href); return s ? <a href={s} target="_blank" rel="noopener noreferrer">{children}</a> : <>{children}</>; } }}
                >
                  {reading.body}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}

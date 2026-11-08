import React from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, Sparkles, Star } from 'lucide-react';
import { KEY_PROVIDER_IDS, PROVIDER_INFO, type AiSettings } from '../../aiSettings';
import { IMAGE_GROUPS, IMAGE_MODELS, formatUsd, imagePrice, type ImageModelDef } from '../../imageModels';
import { cn } from '../../lib/utils';
import type { Update } from '../SettingsModal';
import { useT } from '../../i18n';

// Settings → Images: the image model catalogue (src/imageModels.ts) checked against what each key reached on
// its last test ("Catalogue + detection"), plus image models a provider has that the catalogue doesn't list yet.

type Availability = 'ok' | 'nokey' | 'untested' | 'keyerror' | 'missing';

function availability(settings: AiSettings, m: ImageModelDef): Availability {
  const st = settings.providers[m.provider];
  if (!st.configured) return 'nokey';
  if (st.status === 'error') return 'keyerror';
  if (st.status !== 'ok') return 'untested';
  return st.models.some((x) => x.kind === 'image' && x.id === m.model) ? 'ok' : 'missing';
}

const AVAILABILITY: Record<Availability, { label: string; className: string; icon: React.ComponentType<{ size?: number }> }> = {
  ok: { label: 'available', className: 'bg-emerald-400/15 text-emerald-300', icon: CheckCircle2 },
  nokey: { label: 'no key', className: 'bg-white/5 text-slate-400', icon: CircleDashed },
  untested: { label: 'key not checked', className: 'bg-amber-400/15 text-amber-300', icon: CircleDashed },
  keyerror: { label: 'key error', className: 'bg-rose-400/15 text-rose-300', icon: AlertTriangle },
  missing: { label: "key can't see it", className: 'bg-rose-400/15 text-rose-300', icon: AlertTriangle },
};

/** Models that can work from a reference picture (mannequin previews of a design, scar cover-ups). */
const EDIT_MODELS = IMAGE_MODELS.filter((m) => m.provider === 'openai' || m.provider === 'google');

function priceLabel(m: ImageModelDef, t: (text: string, vars?: Record<string, string | number>) => string): string {
  if (typeof m.price === 'number') return t('{price} / picture', { price: formatUsd(m.price) });
  return Object.entries(m.price)
    .map(([tier, usd]) => `${tier} ${formatUsd(usd)}`)
    .join(' · ');
}

export default function ImagesTab({ settings, update, goToKeys }: { settings: AiSettings; update: Update; goToKeys: () => void }) {
  const t = useT();
  const { image } = settings.prefs;
  const disabled = new Set(image.disabled);
  const anyKey = KEY_PROVIDER_IDS.some((p) => settings.providers[p].configured && IMAGE_MODELS.some((m) => m.provider === p));

  const toggle = (id: string) => {
    const next = disabled.has(id) ? image.disabled.filter((x) => x !== id) : [...image.disabled, id];
    update({ image: { disabled: next } });
  };

  // Image models a working key reaches that the catalogue doesn't describe (no price or notes yet).
  const extra = KEY_PROVIDER_IDS.flatMap((p) => {
    const st = settings.providers[p];
    if (st.status !== 'ok') return [];
    const known = new Set(IMAGE_MODELS.filter((m) => m.provider === p).map((m) => m.model));
    return st.models.filter((m) => m.kind === 'image' && !known.has(m.id)).map((m) => ({ provider: p, ...m }));
  });

  const sampleModel = IMAGE_MODELS.find((m) => m.id === image.sampleModel);
  const editModel = EDIT_MODELS.find((m) => m.id === image.editModel);
  const unavailable = (m: ImageModelDef) => (availability(settings, m) === 'ok' ? '' : ` (${t(AVAILABILITY[availability(settings, m)].label)})`);

  return (
    <div className="space-y-5">
      {!anyKey && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-sm text-amber-200 flex items-center gap-3">
          <AlertTriangle size={18} className="shrink-0" />
          <span className="flex-1">{t('Image models work once you add an OpenAI, Google, Replicate (FLUX) or Stability AI key. After the key is checked you will see which models are available.')}</span>
          <button type="button" onClick={goToKeys} className="h-11 px-4 rounded-lg bg-amber-400 text-black font-semibold shrink-0">
            {t('Add key')}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="space-y-2">
          <label htmlFor="sample-model" className="field-label">{t('Option thumbnail model')}</label>
          <select id="sample-model" value={image.sampleModel} onChange={(e) => update({ image: { sampleModel: e.target.value } })} className="field text-base">
            {IMAGE_MODELS.map((m) => (
              <option key={m.id} value={m.id} disabled={disabled.has(m.id)}>
                {m.label} · {PROVIDER_INFO[m.provider].company} · {t('{price} / thumbnail', { price: formatUsd(imagePrice(m, m.sizing.kind === 'tier' ? m.sizing.tiers[0] : undefined)) })}
                {unavailable(m)}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            {t('Thumbnails in the option window (256 px). Before each run you will see the total cost and have to confirm it.')}
            {sampleModel && availability(settings, sampleModel) !== 'ok' && ` ${t('This model is not available right now — check the key.')}`}
          </p>
        </section>

        <section className="space-y-2">
          <label htmlFor="edit-model" className="field-label">{t('Edit model (mannequin previews of a design, scar cover-ups)')}</label>
          <select id="edit-model" value={image.editModel} onChange={(e) => update({ image: { editModel: e.target.value } })} className="field text-base">
            {EDIT_MODELS.map((m) => (
              <option key={m.id} value={m.id} disabled={disabled.has(m.id)}>
                {m.label} · {PROVIDER_INFO[m.provider].company} · {t('{price} / picture', { price: formatUsd(imagePrice(m, m.sizing.kind === 'tier' ? m.sizing.defaultTier : undefined)) })}
                {unavailable(m)}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            {t('Works from a reference picture, so only OpenAI and Gemini models are listed.')}
            {editModel && availability(settings, editModel) !== 'ok' && ` ${t('This model is not available right now — check the key.')}`}
          </p>
        </section>
      </div>

      {IMAGE_GROUPS.map((group) => (
        <section key={group.id} className="space-y-2">
          <h3 className="field-label flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: group.tone }} aria-hidden="true" />
            {t(group.label)}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {IMAGE_MODELS.filter((m) => m.group === group.id).map((m) => {
              const av = availability(settings, m);
              const A = AVAILABILITY[av];
              const off = disabled.has(m.id);
              const isDefault = image.defaultModel === m.id;
              return (
                <article key={m.id} className={cn('p-3 rounded-xl border bg-brand-panel flex flex-col gap-2', isDefault ? 'border-violet-400/60' : 'border-white/10', off && 'opacity-60')}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-white truncate">{m.label}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {PROVIDER_INFO[m.provider].company} · {m.speed}
                      </p>
                    </div>
                    <span className={cn('h-7 px-2 rounded-lg text-[11px] font-semibold flex items-center gap-1 shrink-0', A.className)}>
                      <A.icon size={13} /> {t(A.label)}
                    </span>
                  </div>
                  <p className="text-sm font-mono text-cyan-200">{priceLabel(m, t)}</p>
                  <p className="text-xs text-slate-400 leading-snug">{t(m.note)}</p>
                  <div className="flex items-center gap-2 mt-auto pt-1">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!off}
                      aria-label={t('{name} on', { name: m.label })}
                      onClick={() => toggle(m.id)}
                      disabled={isDefault && !off}
                      className="h-11 px-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-sm text-slate-200 disabled:opacity-50"
                    >
                      <span className={cn('w-10 h-6 rounded-full p-0.5 transition-colors', off ? 'bg-white/15' : 'bg-violet-400')}>
                        <span className={cn('block w-5 h-5 rounded-full bg-white transition-transform', !off && 'translate-x-4')} />
                      </span>
                      {off ? t('Off') : t('On')}
                    </button>
                    <button
                      type="button"
                      aria-pressed={isDefault}
                      disabled={off}
                      onClick={() => update({ image: { defaultModel: m.id } })}
                      className={cn(
                        'h-11 px-3 rounded-xl border text-sm font-semibold flex items-center gap-1.5 disabled:opacity-40',
                        isDefault ? 'bg-violet-400/15 border-violet-400/50 text-violet-200' : 'bg-white/5 border-white/10 text-slate-300',
                      )}
                    >
                      <Star size={15} className={isDefault ? 'fill-current' : undefined} /> {isDefault ? t('Default') : t('Set as default')}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <section className="space-y-2">
        <h3 className="field-label flex items-center gap-2">
          <Sparkles size={14} /> {t('New provider models')}
        </h3>
        {extra.length === 0 ? (
          <p className="text-xs text-slate-500">{t('Once the keys are checked, image models the catalogue does not describe yet will show up here.')}</p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2">
              {extra.map((m) => (
                <li key={`${m.provider}:${m.id}`} className="min-h-9 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 max-w-full">
                  <span className="break-all">{m.label}</span> <span className="text-slate-500">· {PROVIDER_INFO[m.provider].company}</span>{' '}
                  <span className="text-amber-300 font-semibold whitespace-nowrap">{t('new — no price')}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500">{t('Providers do not publish prices through their APIs. To use such a model, add it with its price to src/imageModels.ts.')}</p>
          </>
        )}
      </section>
    </div>
  );
}

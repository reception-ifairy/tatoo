import React from 'react';
import { Check, X, MessagesSquare, PenLine, BookOpen, Library } from 'lucide-react';
import { KIND_INFO } from './kinds';
import type { OutputKind, PackageDef, Usage } from '../../account';
import { useI18n } from '../../i18n';
import { cn } from '../../lib/utils';

// Everything a package includes, always listed in full (included or not), with what is left of each kind.

export { KIND_INFO } from './kinds';

export default function PackageCard({ pkg, usage, compact = false }: { pkg: PackageDef | null; usage?: Usage; compact?: boolean }) {
  const { t } = useI18n();
  if (!pkg) {
    return <div className="panel p-4 text-sm text-slate-400">{t('No package yet. The studio will assign one to your account.')}</div>;
  }
  const rows: { key: string; icon: typeof PenLine; label: string; note: string; included: boolean; count?: string }[] = [
    { key: 'consultation', icon: MessagesSquare, label: t('Consultation with Ötzi'), note: t('From feeling and symbol to a design and a studio brief.'), included: pkg.consultation },
    ...(['stencil', 'colour', 'mannequin', 'scar'] as OutputKind[]).map((k) => {
      const limit = pkg.limits[k];
      const used = usage?.[k] ?? 0;
      return {
        key: k,
        icon: KIND_INFO[k].icon,
        label: t(KIND_INFO[k].label),
        note: t(KIND_INFO[k].note),
        included: limit > 0,
        count: limit > 0 ? (usage ? t('{left} of {limit} left', { left: Math.max(0, limit - used), limit }) : String(limit)) : undefined,
      };
    }),
    { key: 'atlas', icon: BookOpen, label: t('Style atlas'), note: t('Every style, technique and fusion in the compendium.'), included: true },
    { key: 'library', icon: Library, label: t('History & library'), note: t('Marks through time and 30 research articles.'), included: true },
  ];
  return (
    <div className="panel p-4 space-y-3">
      <div>
        <p className="text-xs font-mono uppercase tracking-wider text-orange-300">{t('Package')}</p>
        <h3 className="font-display text-xl font-semibold text-white">{pkg.name}</h3>
        {!compact && pkg.description && <p className="text-sm text-slate-400 mt-1">{t(pkg.description)}</p>}
      </div>
      <ul className={cn('grid gap-1.5', compact ? 'grid-cols-1' : 'sm:grid-cols-2')}>
        {rows.map((r) => (
          <li key={r.key} className={cn('flex items-start gap-2.5 rounded-xl px-3 py-2 border', r.included ? 'border-white/10 bg-white/[0.03]' : 'border-transparent opacity-50')}>
            <r.icon size={18} className={cn('shrink-0 mt-0.5', r.included ? 'text-orange-300' : 'text-slate-500')} />
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-2 text-sm text-slate-100">
                {r.label}
                {r.count && <span className="text-xs font-mono text-orange-200">{r.count}</span>}
              </span>
              {!compact && <span className="block text-xs text-slate-500">{r.note}</span>}
            </span>
            {r.included ? <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" aria-label={t('Included')} /> : <X size={16} className="text-slate-500 shrink-0 mt-0.5" aria-label={t('Not included')} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

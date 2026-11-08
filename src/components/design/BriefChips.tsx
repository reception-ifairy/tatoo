import React from 'react';
import type { DesignBrief } from '../../design';
import type { OptionSet } from '../../options';
import { useT } from '../../i18n';
import OptionVisual from '../options/OptionVisual';

/** The chosen options of a brief as small chips (thumbnail + label), in group order. */
export default function BriefChips({ brief, set, max = 12 }: { brief: DesignBrief; set: OptionSet | null; max?: number }) {
  const t = useT();
  if (!set) return null;
  const chosen = set.groups.flatMap((group) => {
    const option = group.options.find((o) => o.code === brief.picks[group.id]);
    return option ? [{ group, option }] : [];
  });
  if (!chosen.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {chosen.slice(0, max).map(({ group, option }) => (
        <li key={group.id} style={{ '--tone': group.tone } as React.CSSProperties} className="h-8 pl-1 pr-2.5 rounded-full border border-white/15 bg-white/5 text-xs text-slate-100 flex items-center gap-1.5 max-w-full">
          <span className="w-6 h-6 rounded-full overflow-hidden shrink-0">
            <OptionVisual group={group} option={option} round />
          </span>
          <span className="text-slate-400 shrink-0">{t(group.label)}:</span>
          <span className="truncate">{t(option.label)}</span>
        </li>
      ))}
    </ul>
  );
}

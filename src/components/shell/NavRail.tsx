import React from 'react';
import { Fingerprint, Menu, ChevronLeft, Languages, type LucideIcon } from 'lucide-react';
import { SETTINGS_ITEM, LOGOUT_ITEM, type SectionDef, type ViewId, type Tone } from '../../lib/sections';
import type { PublicUser } from '../../account';
import { APP } from '../../config';
import { useI18n } from '../../i18n';
import { api } from '../../lib/appApi';
import { cn } from '../../lib/utils';

interface NavRailProps {
  view: ViewId;
  sections: SectionDef[];
  onNavigate: (view: ViewId) => void;
  user: PublicUser;
  onUser: (user: PublicUser) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

/**
 * Touch navigation. Tablet/desktop: a left rail with icons only; the menu button expands it over the content
 * (layouts don't reflow) to show labels, the account and the package. Phone: a bottom bar that scrolls sideways.
 * The super admin also gets Settings and the EN / PL switch.
 */
export default function NavRail({ view, sections, onNavigate, user, onUser, onOpenSettings, onLogout }: NavRailProps) {
  const { t, lang } = useI18n();
  const [expanded, setExpanded] = React.useState(false);
  const isAdmin = user.role === 'admin';

  React.useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setExpanded(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const pick = (fn: () => void) => () => {
    setExpanded(false);
    fn();
  };
  const switchLang = () => api.setLang(lang === 'pl' ? 'en' : 'pl').then(onUser, () => undefined);

  return (
    <>
      <aside className="hidden md:block relative w-20 shrink-0 h-full z-40">
        {expanded && <div className="fixed inset-0 bg-black/70" onClick={() => setExpanded(false)} aria-hidden="true" />}
        <nav
          aria-label={t('Navigation')}
          className={cn('absolute inset-y-0 left-0 flex flex-col gap-1 p-3 bg-black border-r border-white/10 transition-[width] duration-200 overflow-hidden', expanded ? 'w-72 shadow-2xl' : 'w-20')}
        >
          <RailButton icon={expanded ? ChevronLeft : Menu} label={expanded ? t('Collapse menu') : t('Expand menu')} expanded={expanded} onClick={() => setExpanded((v) => !v)} ariaExpanded={expanded} />

          <div className="flex items-center gap-3 h-14 my-1">
            <span className="w-14 h-14 shrink-0 rounded-full bg-orange-400/10 flex items-center justify-center text-orange-300">
              <Fingerprint size={26} />
            </span>
            {expanded && (
              <div className="min-w-0">
                <p className="font-display font-semibold text-white leading-tight">{APP.name}</p>
                <p className="text-xs text-orange-300 truncate">{isAdmin ? t('Studio admin') : user.package ? t('Package: {name}', { name: user.package.name }) : t('No package yet')}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1 min-h-0 overflow-y-auto overflow-x-hidden">
            {sections.map((s) => (
              <React.Fragment key={s.id}>
                <RailButton icon={s.icon} tone={s.tone} label={t(s.label)} active={view === s.id} expanded={expanded} onClick={pick(() => onNavigate(s.id))} />
              </React.Fragment>
            ))}
          </div>

          <div className="flex-1 min-h-0">
            {expanded && (
              <div className="mt-3 p-4 rounded-2xl bg-brand-panel border border-white/10 text-sm text-slate-400 space-y-1 whitespace-nowrap">
                <p className="text-white font-semibold truncate">{user.displayName}</p>
                <p className="text-xs text-slate-500 font-mono truncate">{user.login}</p>
              </div>
            )}
          </div>

          {isAdmin && (
            <RailButton
              icon={Languages}
              tone={SETTINGS_ITEM.tone}
              label={lang === 'pl' ? 'Interfejs: polski → English' : 'Interface: English → polski'}
              expanded={expanded}
              onClick={switchLang}
              badgeText={lang.toUpperCase()}
            />
          )}
          {isAdmin && <RailButton icon={SETTINGS_ITEM.icon} tone={SETTINGS_ITEM.tone} label={t(SETTINGS_ITEM.label)} expanded={expanded} onClick={pick(onOpenSettings)} />}
          <RailButton icon={LOGOUT_ITEM.icon} tone={LOGOUT_ITEM.tone} label={t(LOGOUT_ITEM.label)} expanded={expanded} onClick={pick(onLogout)} />
        </nav>
      </aside>

      {/* Phone bottom bar */}
      <nav aria-label={t('Navigation')} className="md:hidden order-last shrink-0 h-16 flex overflow-x-auto border-t border-white/10 bg-black">
        {sections.map((s) => {
          const Icon = s.icon;
          const active = view === s.id;
          return (
            <button key={s.id} type="button" onClick={() => onNavigate(s.id)} aria-label={t(s.label)} aria-current={active ? 'page' : undefined} className="relative flex-1 min-w-14 flex items-center justify-center">
              <span className={cn('w-12 h-11 rounded-2xl flex items-center justify-center', active ? cn(s.tone.soft, s.tone.text) : s.tone.text, !active && 'opacity-70')}>
                <Icon size={22} />
              </span>
            </button>
          );
        })}
        {isAdmin && (
          <button type="button" onClick={onOpenSettings} aria-label={t(SETTINGS_ITEM.label)} className="flex-1 min-w-14 flex items-center justify-center text-violet-400 opacity-70">
            <SETTINGS_ITEM.icon size={22} />
          </button>
        )}
        <button type="button" onClick={onLogout} aria-label={t(LOGOUT_ITEM.label)} className="flex-1 min-w-14 flex items-center justify-center text-rose-400 opacity-70">
          <LOGOUT_ITEM.icon size={22} />
        </button>
      </nav>
    </>
  );
}

function RailButton({
  icon: Icon, label, onClick, expanded, tone, active = false, ariaExpanded, badgeText,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  expanded: boolean;
  tone?: Tone;
  active?: boolean;
  ariaExpanded?: boolean;
  badgeText?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={expanded ? undefined : label}
      aria-current={active ? 'page' : undefined}
      aria-expanded={ariaExpanded}
      className={cn(
        'relative h-14 shrink-0 rounded-2xl flex items-center gap-4 border transition-colors',
        expanded ? 'w-full px-4' : 'w-14 justify-center',
        active && tone ? cn(tone.soft, tone.border) : 'border-transparent active:bg-white/10',
      )}
    >
      <Icon size={24} className={cn('shrink-0', tone ? tone.text : 'text-slate-300')} />
      {expanded && <span className={cn('flex-1 text-left text-base whitespace-nowrap truncate', active && tone ? cn(tone.text, 'font-semibold') : 'text-slate-200')}>{label}</span>}
      {badgeText && <span className={cn('absolute text-[10px] font-bold font-mono text-violet-200', expanded ? 'right-4' : 'bottom-1 right-1')}>{badgeText}</span>}
    </button>
  );
}

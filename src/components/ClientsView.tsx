import React from 'react';
import { UserPlus, Users, Package, Save, Trash2, KeyRound, RotateCcw, Power, Plus, Loader2, Check } from 'lucide-react';
import { OUTPUT_KINDS, type PackageDef, type PublicUser } from '../account';
import { useI18n } from '../i18n';
import { getSection } from '../lib/sections';
import { api } from '../lib/appApi';
import { cn } from '../lib/utils';
import ViewHeader, { ViewBody, HeaderButton } from './shell/ViewHeader';
import Sheet from './ui/Sheet';
import { KIND_INFO } from './design/PackageCard';

// The super admin's panel: client accounts (login, password, package, usage) and the packages themselves.
// Clients don't pay in the app; the package limits are the admin's standing consent to spend on their pictures.

type Tab = 'clients' | 'packages';

const randomPassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => chars[b % chars.length]).join('');
};

export default function ClientsView() {
  const section = getSection('clients');
  const { t, locale } = useI18n();
  const [tab, setTab] = React.useState<Tab>('clients');
  const [clients, setClients] = React.useState<PublicUser[] | null>(null);
  const [packages, setPackages] = React.useState<PackageDef[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState({ login: '', displayName: '', password: randomPassword(), packageId: '' });
  const [passwordFor, setPasswordFor] = React.useState<PublicUser | null>(null);
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<PackageDef[]>([]);
  const [savedPackages, setSavedPackages] = React.useState(false);

  const reload = React.useCallback(() => {
    api.clients().then(setClients, (err) => setError(err.message));
    api.packages().then((p) => { setPackages(p); setDraft(p); }, (err) => setError(err.message));
  }, []);
  React.useEffect(reload, [reload]);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      reload();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const create = () =>
    act(async () => {
      await api.createClient({ ...form, packageId: form.packageId || packages[0]?.id || '' });
      setCreating(false);
      setForm({ login: '', displayName: '', password: randomPassword(), packageId: '' });
    });

  const savePackages = () =>
    act(async () => {
      const p = await api.savePackages(draft);
      setDraft(p);
      setSavedPackages(true);
      setTimeout(() => setSavedPackages(false), 1500);
    });

  const editPkg = (i: number, patch: Partial<PackageDef>) => setDraft((d) => d.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <>
      <ViewHeader section={section}>
        <div className="flex rounded-xl border border-white/10 overflow-hidden" role="tablist">
          {(['clients', 'packages'] as Tab[]).map((x) => (
            <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => setTab(x)} className={cn('h-12 px-4 text-sm flex items-center gap-2', tab === x ? 'bg-cyan-400/15 text-cyan-200' : 'text-slate-400')}>
              {x === 'clients' ? <Users size={16} /> : <Package size={16} />} {x === 'clients' ? t('Clients') : t('Packages')}
            </button>
          ))}
        </div>
        {tab === 'clients' ? (
          <HeaderButton tone="primary" onClick={() => setCreating(true)}><UserPlus size={18} /> <span className="hidden sm:inline">{t('New client')}</span></HeaderButton>
        ) : (
          <HeaderButton tone="primary" onClick={savePackages}>{savedPackages ? <Check size={18} /> : <Save size={18} />} <span className="hidden sm:inline">{t('Save packages')}</span></HeaderButton>
        )}
      </ViewHeader>
      <ViewBody className="flex flex-col gap-3">
        {error && <p className="text-sm text-rose-300 shrink-0">{error}</p>}
        {tab === 'clients' ? (
          !clients ? (
            <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> {t('Loading…')}</p>
          ) : clients.length === 0 ? (
            <div className="panel p-6 max-w-lg text-sm text-slate-300 space-y-3">
              <p>{t('No clients yet. Create an account, give it a package, and hand the login and password to the client.')}</p>
              <button type="button" onClick={() => setCreating(true)} className="h-12 px-4 rounded-xl bg-orange-400 text-black font-semibold flex items-center gap-2"><UserPlus size={16} /> {t('New client')}</button>
            </div>
          ) : (
            <ul className="flex-1 min-h-0 overflow-y-auto grid gap-2 content-start lg:grid-cols-2">
              {clients.map((c) => (
                <li key={c.id} className={cn('panel p-3 space-y-2', !c.active && 'opacity-60')}>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">{c.displayName}</p>
                      <p className="text-[11px] font-mono text-slate-500 truncate">{c.login} · {t('since {date}', { date: new Date(c.createdAt).toLocaleDateString(locale) })}{!c.active && ` · ${t('inactive')}`}</p>
                    </div>
                    <select value={c.packageId ?? ''} onChange={(e) => act(() => api.updateClient(c.id, { packageId: e.target.value }))} className="field h-11 w-40 text-sm" aria-label={t('Package')}>
                      {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <ul className="grid grid-cols-4 gap-1.5">
                    {OUTPUT_KINDS.map((k) => {
                      const limit = c.package?.limits[k] ?? 0;
                      const used = c.usage[k] ?? 0;
                      return (
                        <li key={k} className="rounded-lg bg-white/[0.03] border border-white/10 px-2 py-1.5">
                          <p className="text-[10px] text-slate-500 truncate">{t(KIND_INFO[k].label)}</p>
                          <p className="text-sm font-mono text-slate-200">{limit ? `${used}/${limit}` : '—'}</p>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex flex-wrap gap-1.5">
                    <SmallButton onClick={() => act(() => api.updateClient(c.id, { resetUsage: true }))}><RotateCcw size={14} /> {t('Reset usage')}</SmallButton>
                    <SmallButton onClick={() => { setPasswordFor(c); setNewPassword(randomPassword()); }}><KeyRound size={14} /> {t('New password')}</SmallButton>
                    <SmallButton onClick={() => act(() => api.updateClient(c.id, { active: !c.active }))}><Power size={14} /> {c.active ? t('Deactivate') : t('Activate')}</SmallButton>
                    <SmallButton danger={confirmDelete === c.id} onClick={() => (confirmDelete === c.id ? act(() => api.deleteClient(c.id)).then(() => setConfirmDelete(null)) : setConfirmDelete(c.id))}>
                      <Trash2 size={14} /> {confirmDelete === c.id ? t('Delete for good') : t('Delete')}
                    </SmallButton>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto grid gap-3 content-start lg:grid-cols-3">
            {draft.map((p, i) => (
              <div key={i} className="panel p-3 space-y-2">
                <div className="flex gap-2">
                  <input value={p.name} onChange={(e) => editPkg(i, { name: e.target.value })} className="field h-11 font-semibold" aria-label={t('Name')} />
                  <button type="button" onClick={() => setDraft((d) => d.filter((_, j) => j !== i))} aria-label={t('Remove package')} className="h-11 w-11 shrink-0 rounded-xl border border-rose-400/40 text-rose-300 grid place-items-center"><Trash2 size={16} /></button>
                </div>
                <textarea value={p.description} rows={2} onChange={(e) => editPkg(i, { description: e.target.value })} className="field h-auto py-2 text-sm resize-none" aria-label={t('Description')} />
                <label className="flex items-center gap-2 text-sm text-slate-200 min-h-11">
                  <input type="checkbox" checked={p.consultation} onChange={(e) => editPkg(i, { consultation: e.target.checked })} className="w-5 h-5 accent-orange-400" />
                  {t('Consultation with Ötzi')}
                </label>
                {OUTPUT_KINDS.map((k) => (
                  <label key={k} className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="flex-1">{t(KIND_INFO[k].label)}</span>
                    <input type="number" min={0} max={10000} value={p.limits[k]} onChange={(e) => editPkg(i, { limits: { ...p.limits, [k]: Math.max(0, Number(e.target.value) || 0) } })} className="field h-11 w-24 text-right font-mono" />
                  </label>
                ))}
                <p className="text-[11px] font-mono text-slate-500">id: {p.id}</p>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setDraft((d) => [...d, { id: `pkg_${Date.now().toString(36)}`, name: t('New package'), description: '', consultation: true, limits: { stencil: 0, colour: 0, mannequin: 0, scar: 0 } }])}
              className="panel p-3 min-h-40 border-dashed text-slate-400 flex flex-col items-center justify-center gap-2"
            >
              <Plus size={22} /> {t('Add package')}
            </button>
          </div>
        )}
      </ViewBody>

      <Sheet open={creating} onClose={() => setCreating(false)} title={t('New client')} icon={UserPlus} tone={section.tone}>
        <div className="space-y-3">
          <Field label={t('Name shown in the app')} value={form.displayName} onChange={(v) => setForm({ ...form, displayName: v })} />
          <Field label={t('Login (letters, digits, . _ -)')} value={form.login} onChange={(v) => setForm({ ...form, login: v.toLowerCase() })} mono />
          <Field label={t('Password (give it to the client)')} value={form.password} onChange={(v) => setForm({ ...form, password: v })} mono />
          <label className="block">
            <span className="field-label">{t('Package')}</span>
            <select value={form.packageId || packages[0]?.id || ''} onChange={(e) => setForm({ ...form, packageId: e.target.value })} className="field">
              {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <button type="button" onClick={create} disabled={!form.login || form.password.length < 8} className="h-12 px-5 rounded-xl bg-orange-400 text-black font-semibold flex items-center gap-2 disabled:opacity-40"><UserPlus size={16} /> {t('Create account')}</button>
        </div>
      </Sheet>

      <Sheet open={Boolean(passwordFor)} onClose={() => setPasswordFor(null)} title={t('New password for {name}', { name: passwordFor?.displayName ?? '' })} icon={KeyRound} tone={section.tone}>
        <div className="space-y-3">
          <Field label={t('New password')} value={newPassword} onChange={setNewPassword} mono />
          <p className="text-xs text-slate-400">{t('Saving signs the client out on every device.')}</p>
          <button
            type="button"
            disabled={newPassword.length < 8}
            onClick={() => passwordFor && act(() => api.updateClient(passwordFor.id, { password: newPassword })).then(() => setPasswordFor(null))}
            className="h-12 px-5 rounded-xl bg-orange-400 text-black font-semibold flex items-center gap-2 disabled:opacity-40"
          >
            <Save size={16} /> {t('Save password')}
          </button>
        </div>
      </Sheet>
    </>
  );
}

function SmallButton({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn('h-10 px-3 rounded-lg text-xs flex items-center gap-1.5 border', danger ? 'bg-rose-500 border-rose-500 text-white' : 'border-white/10 text-slate-300 active:bg-white/10')}>
      {children}
    </button>
  );
}

function Field({ label, value, onChange, mono }: { label: string; value: string; onChange: (v: string) => void; mono?: boolean }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} autoCapitalize="none" className={cn('field', mono && 'font-mono')} />
    </label>
  );
}

import React from 'react';
import Dashboard from './components/Dashboard';
import ChatView, { type ChatPreset } from './components/ChatView';
import GeneratorView from './components/GeneratorView';
import ProjectsView from './components/ProjectsView';
import AtlasView from './components/AtlasView';
import LibraryView from './components/LibraryView';
import ScarView from './components/ScarView';
import ClientsView from './components/ClientsView';
import LoginScreen from './components/LoginScreen';
import SettingsModal from './components/SettingsModal';
import NavRail from './components/shell/NavRail';
import { SpeechToast } from './components/voice/SpeakButton';
import type { PublicUser } from './account';
import type { Compendium } from './compendium';
import { APP } from './config';
import { I18nProvider } from './i18n';
import { SESSION_EXPIRED_EVENT } from './lib/utils';
import { VIEW_IDS, sectionsFor, type ViewId } from './lib/sections';
import { useHashView } from './lib/useHashView';
import { AiSettingsProvider } from './lib/aiSettingsContext';
import { AppContext, type GeneratorRequest } from './lib/appContext';
import { api } from './lib/appApi';
import { optionsApi } from './lib/optionsClient';
import type { OptionSet } from './options';
import { stopSpeech } from './lib/speech';

export default function App() {
  const [user, setUser] = React.useState<PublicUser | null>(null);
  const [checkingSession, setCheckingSession] = React.useState(true);

  React.useEffect(() => {
    document.title = APP.name;
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false));
    const handleExpired = () => setUser(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, []);

  const handleLogout = async () => {
    stopSpeech();
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } finally {
      setUser(null);
    }
  };

  if (checkingSession) {
    return (
      <div className="h-full flex items-center justify-center bg-brand-bg">
        <div className="w-10 h-10 rounded-full border-2 border-orange-500/30 border-t-orange-400 animate-spin" />
      </div>
    );
  }
  if (!user) return <LoginScreen onLoggedIn={setUser} />;

  const lang = user.role === 'admin' ? user.lang : 'en';
  const shell = <Shell key={user.id} user={user} onUser={setUser} onLogout={handleLogout} />;
  return (
    <I18nProvider lang={lang}>
      {user.role === 'admin' ? <AiSettingsProvider>{shell}</AiSettingsProvider> : shell}
    </I18nProvider>
  );
}

function Shell({ user, onUser, onLogout }: { user: PublicUser; onUser: (u: PublicUser) => void; onLogout: () => void }) {
  const [view, navigate] = useHashView<ViewId>(VIEW_IDS, 'studio');
  const [compendium, setCompendium] = React.useState<Compendium | null>(null);
  const [chatPreset, setChatPreset] = React.useState<ChatPreset | null>(null);
  const [generatorRequest, setGeneratorRequest] = React.useState<GeneratorRequest | null>(null);
  const [scarRequest, setScarRequest] = React.useState<{ projectId?: string; nonce: number } | null>(null);
  const [projectsVersion, setProjectsVersion] = React.useState(0);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const [optionSet, setOptionSet] = React.useState<OptionSet | null>(null);

  React.useEffect(() => {
    api.compendium().then(setCompendium, () => setCompendium(null));
    optionsApi.state().then((s) => setOptionSet(s.sets[0] ?? null), () => setOptionSet(null));
  }, []);

  const visible = sectionsFor(user);
  const current: ViewId = visible.some((s) => s.id === view) ? view : 'studio';

  const refreshUser = React.useCallback(() => {
    api.me().then(onUser, () => undefined);
  }, [onUser]);

  const value = React.useMemo(
    () => ({
      user,
      refreshUser,
      compendium,
      optionSet,
      setOptionSet,
      navigate,
      openGenerator: (request: Omit<GeneratorRequest, 'nonce'>) => {
        setGeneratorRequest({ ...request, nonce: Date.now() });
        navigate('generator');
      },
      openScar: (projectId?: string) => {
        setScarRequest({ projectId, nonce: Date.now() });
        navigate('scar');
      },
      startChat: (message: string) => {
        setChatPreset({ message, nonce: Date.now() });
        navigate('consult');
      },
      projectsVersion,
      projectsChanged: () => setProjectsVersion((v) => v + 1),
      openSettings: () => setSettingsOpen(true),
    }),
    [user, refreshUser, compendium, optionSet, navigate, projectsVersion],
  );

  const can = (id: ViewId) => visible.some((s) => s.id === id);

  return (
    <AppContext.Provider value={value}>
      <div className="h-full flex flex-col md:flex-row bg-brand-bg text-slate-100 overflow-hidden">
        <NavRail view={current} sections={visible} onNavigate={navigate} user={user} onUser={onUser} onOpenSettings={() => setSettingsOpen(true)} onLogout={onLogout} />

        {/* Views stay mounted (only hidden), so a running reply or picture survives switching views. */}
        <main className="relative flex-1 min-w-0 min-h-0">
          <ViewSlot active={current === 'studio'}>
            <Dashboard />
          </ViewSlot>
          {can('consult') && (
            <ViewSlot active={current === 'consult'}>
              <ChatView preset={chatPreset} />
            </ViewSlot>
          )}
          <ViewSlot active={current === 'generator'}>
            <GeneratorView request={generatorRequest} />
          </ViewSlot>
          <ViewSlot active={current === 'projects'}>
            <ProjectsView />
          </ViewSlot>
          <ViewSlot active={current === 'atlas'}>
            <AtlasView />
          </ViewSlot>
          <ViewSlot active={current === 'library'}>
            <LibraryView />
          </ViewSlot>
          {can('scar') && (
            <ViewSlot active={current === 'scar'}>
              <ScarView request={scarRequest} />
            </ViewSlot>
          )}
          {can('clients') && (
            <ViewSlot active={current === 'clients'}>
              <ClientsView />
            </ViewSlot>
          )}
        </main>

        {user.role === 'admin' && <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
        <SpeechToast />
      </div>
    </AppContext.Provider>
  );
}

function ViewSlot({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <section aria-hidden={!active} className={active ? 'absolute inset-0 flex flex-col' : 'hidden'}>
      {children}
    </section>
  );
}

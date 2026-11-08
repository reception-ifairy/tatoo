import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Fingerprint, Plus, Send, Square, Trash2, Copy, Check, History, ArrowDown,
  AlertTriangle, MessagesSquare, Camera, X, Loader2, Wand2, ScrollText, ShieldAlert,
} from 'lucide-react';
import type { ChatEvent, ChatMessage, ConversationSummary } from '../chat';
import type { DesignBrief } from '../design';
import type { ActivityStep } from '../types';
import { APP } from '../config';
import { useI18n } from '../i18n';
import { getSection } from '../lib/sections';
import { useApp } from '../lib/appContext';
import { useOptionalAiSettings } from '../lib/aiSettingsContext';
import { useVoiceMessage } from '../lib/useVoiceMessage';
import { chatImageUrl, deleteConversation, getConversation, listConversations, sendChatMessage, uploadChatImage } from '../lib/chatClient';
import { resizeImage } from '../lib/resizeImage';
import { cn, safeUrl } from '../lib/utils';
import ViewHeader, { ViewBody, HeaderButton } from './shell/ViewHeader';
import SpeakButton from './voice/SpeakButton';
import { RecordButton } from './voice/VoiceMessage';
import Sheet from './ui/Sheet';
import BriefChips from './design/BriefChips';
import { ActivityChips, ActivityPanel } from './ActivityTimeline';

// The consultation with Ötzi. His six-phase method lives in the system prompt (server/persona.ts); when he writes
// a design_spec, the server matches it to the generator's options and the reply shows a design card with
// "Open in generator". A studio_brief shows as a card that can be copied or kept with the design.

/** A prompt sent from another view (e.g. the studio's quick start). */
export interface ChatPreset {
  message: string;
  nonce: number;
}

const MAX_IMAGES = 3;

interface Attachment {
  id: string;
  preview: string;
}

interface SendOptions {
  imageIds?: string[];
  fresh?: boolean;
}

const QUICK_PROMPTS = [
  'I want a tattoo to close an important chapter',
  'Which styles age best?',
  'Something small and meaningful for my wrist',
  'Help me turn a memory into a design',
];

interface Draft {
  content: string;
  steps: ActivityStep[];
  status: string;
  error: string | null;
}

/** The fenced blocks are shown as cards, not as code. */
const stripBlocks = (text: string) => text.replace(/```(design_spec|studio_brief|image_prompt)[\s\S]*?(```|$)/g, '').replace(/\n{3,}/g, '\n\n').trim();

export default function ChatView({ preset }: { preset?: ChatPreset | null }) {
  const section = getSection('consult');
  const { t, locale } = useI18n();
  const { user } = useApp();
  const ai = useOptionalAiSettings();
  const isAdmin = user.role === 'admin';
  const voiceReady = isAdmin && Boolean(ai?.voiceReady);
  const engineReady = isAdmin ? Boolean(ai?.engineReady) : true;
  const [conversations, setConversations] = React.useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [input, setInput] = React.useState('');
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const [atBottom, setAtBottom] = React.useState(true);
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const controllerRef = React.useRef<AbortController | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const sending = draft !== null;
  const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: APP.timezone });

  const recorder = useVoiceMessage((v) => {
    recorder.reset();
    setInput((prev) => (prev ? `${prev} ${v.transcript}` : v.transcript));
    textareaRef.current?.focus();
  });

  const refreshList = React.useCallback(() => {
    listConversations()
      .then(setConversations)
      .catch((err) => setLoadError(err.message));
  }, []);
  React.useEffect(refreshList, [refreshList]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottom) el.scrollTop = el.scrollHeight;
  }, [messages, draft, atBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  const open = async (id: string) => {
    if (sending) return;
    setHistoryOpen(false);
    setLoadError(null);
    try {
      const conv = await getConversation(id);
      setActiveId(conv.id);
      setMessages(conv.messages);
      setAtBottom(true);
    } catch (err: any) {
      setLoadError(err.message);
    }
  };

  const startNew = () => {
    if (sending) return;
    setActiveId(null);
    setMessages([]);
    setHistoryOpen(false);
    textareaRef.current?.focus();
  };

  const remove = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    setConfirmDelete(null);
    await deleteConversation(id).catch(() => {});
    if (activeId === id) startNew();
    refreshList();
  };

  const addPhotos = async (files: FileList | null) => {
    const list = [...(files ?? [])].slice(0, MAX_IMAGES - attachments.length);
    if (!list.length) return;
    setUploading(true);
    setLoadError(null);
    try {
      for (const file of list) {
        const blob = await resizeImage(file);
        const { id } = await uploadChatImage(blob);
        setAttachments((prev) => [...prev, { id, preview: URL.createObjectURL(blob) }]);
      }
    } catch (err: any) {
      setLoadError(err?.message || t('Could not add the picture.'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removePhoto = (id: string) =>
    setAttachments((prev) => {
      const gone = prev.find((a) => a.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return prev.filter((a) => a.id !== id);
    });

  const send = async (text: string, opts: SendOptions = {}) => {
    const message = text.trim();
    const imageIds = opts.imageIds ?? [];
    if ((!message && !imageIds.length) || sending) return;
    setInput('');
    setAtBottom(true);
    const local: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: message || 'What do you see in this picture?',
      images: imageIds,
      sources: [], steps: [], status: 'complete', createdAt: new Date().toISOString(),
    };
    const conversationId = opts.fresh ? null : activeId;
    if (opts.fresh) {
      setActiveId(null);
      setMessages([local]);
    } else {
      setMessages((m) => [...m, local]);
    }
    const d: Draft = { content: '', steps: [], status: t('Connecting…'), error: null };
    setDraft(d);
    const controller = new AbortController();
    controllerRef.current = controller;
    let current = d;
    const patch = (fn: (prev: Draft) => Draft) => {
      current = fn(current);
      setDraft(current);
    };

    const onEvent = (e: ChatEvent) => {
      switch (e.type) {
        case 'conversation':
          setActiveId(e.id);
          setMessages((m) => m.map((x) => (x.id === local.id ? { ...x, content: e.content || x.content, images: e.images ?? x.images } : x)));
          break;
        case 'status':
          patch((p) => ({ ...p, status: e.text }));
          break;
        case 'activity':
          patch((p) => {
            const exists = p.steps.some((s) => s.id === e.step.id);
            return { ...p, steps: exists ? p.steps.map((s) => (s.id === e.step.id ? e.step : s)) : [...p.steps, e.step], status: exists ? p.status : t('{name} is thinking…', { name: APP.assistantName }) };
          });
          break;
        case 'delta':
          patch((p) => ({ ...p, content: p.content + e.text, status: t('Writing…') }));
          break;
        case 'fail':
          patch((p) => ({ ...p, error: e.message }));
          break;
        case 'saved':
          setMessages((m) => [
            ...m,
            {
              id: e.messageId, role: 'assistant', content: current.content, sources: [], steps: current.steps, status: e.status,
              createdAt: new Date().toISOString(), brief: e.brief, studioBrief: e.studioBrief,
            },
          ]);
          break;
      }
    };

    try {
      await sendChatMessage({ conversationId, message, imageIds }, onEvent, controller.signal);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setMessages((m) => [...m, { ...local, id: `err-${Date.now()}`, role: 'assistant', content: current.content, status: 'error', steps: current.steps, sources: [] }]);
        setLoadError(err?.message || t('Could not send the message.'));
      }
    } finally {
      controllerRef.current = null;
      setDraft(null);
      refreshList();
    }
  };

  const sendComposer = () => {
    const ids = attachments.map((a) => a.id);
    attachments.forEach((a) => URL.revokeObjectURL(a.preview));
    setAttachments([]);
    send(input, { imageIds: ids });
  };

  React.useEffect(() => {
    if (!preset) return;
    if (sending) {
      setLoadError(t('{name} is still answering — wait, or stop the reply and try again.', { name: APP.assistantName }));
      return;
    }
    send(preset.message, { fresh: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset?.nonce]);

  const stop = () => controllerRef.current?.abort();
  const lastFailed = messages.length > 0 && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].status === 'error';

  return (
    <>
      <ViewHeader section={section}>
        <span className="md:hidden">
          <HeaderButton onClick={() => setHistoryOpen(true)} label={t('Past consultations')}>
            <History size={18} />
          </HeaderButton>
        </span>
        <HeaderButton tone="primary" onClick={startNew} disabled={sending}>
          <Plus size={18} /> <span className="hidden sm:inline">{t('New consultation')}</span>
        </HeaderButton>
      </ViewHeader>

      <ViewBody className="flex gap-4 md:overflow-hidden">
        <aside className="hidden md:flex w-72 shrink-0 panel p-3 flex-col gap-2 min-h-0">
          <ConversationList items={conversations} activeId={activeId} confirmDelete={confirmDelete} onOpen={open} onDelete={remove} timeOf={timeOf} />
        </aside>

        <section className="relative flex-1 min-w-0 min-h-[60vh] md:min-h-0 flex flex-col rounded-2xl border border-white/10 bg-brand-panel overflow-hidden">
          <div ref={scrollRef} onScroll={onScroll} className="relative flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-5 flex flex-col gap-5" data-chat-scroll>
            {messages.length === 0 && !draft && <EmptyState timeOf={timeOf} />}
            {messages.map((m) => (
              <React.Fragment key={m.id}>
                <MessageView message={m} timeOf={timeOf} conversationId={activeId} canSpeak={voiceReady} />
              </React.Fragment>
            ))}
            {draft && <DraftView draft={draft} />}
            {lastFailed && !draft && (
              <button
                type="button"
                onClick={() => {
                  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
                  if (lastUser) send(lastUser.content, { imageIds: lastUser.images });
                }}
                className="self-center h-11 px-4 rounded-xl border border-dashed border-amber-400/60 text-amber-300 font-mono text-xs"
              >
                {t('No reply — try again')}
              </button>
            )}
          </div>

          {!atBottom && (
            <button type="button" onClick={() => setAtBottom(true)} className="absolute left-1/2 -translate-x-1/2 bottom-36 h-10 px-4 rounded-full bg-brand-raised border border-white/10 text-sm text-slate-200 flex items-center gap-1 shadow-xl z-10">
              <ArrowDown size={16} /> {t('latest')}
            </button>
          )}

          <Composer
            input={input}
            setInput={setInput}
            sending={sending}
            disabled={!engineReady}
            onSend={sendComposer}
            onStop={stop}
            attachments={attachments}
            uploading={uploading}
            canAttach={isAdmin}
            onPickPhoto={() => fileRef.current?.click()}
            onRemovePhoto={removePhoto}
            onPrompt={(p) => send(t(p))}
            showPrompts={messages.length === 0 && !draft}
            textareaRef={textareaRef}
            recorder={voiceReady ? recorder : null}
          />
          {isAdmin && (
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} data-chat-photo-input />
          )}
          {(loadError || !engineReady) && (
            <p className="px-4 pb-2 text-xs font-mono text-rose-300 flex items-center gap-1.5">
              <AlertTriangle size={14} /> {loadError ?? t('The chosen AI engine has no key — add it in Settings.')}
            </p>
          )}
        </section>
      </ViewBody>

      <Sheet open={historyOpen} onClose={() => setHistoryOpen(false)} title={t('Past consultations')} icon={MessagesSquare} tone={section.tone}>
        <ConversationList items={conversations} activeId={activeId} confirmDelete={confirmDelete} onOpen={open} onDelete={remove} timeOf={timeOf} />
      </Sheet>
    </>
  );
}

function ConversationList({
  items, activeId, confirmDelete, onOpen, onDelete, timeOf,
}: {
  items: ConversationSummary[];
  activeId: string | null;
  confirmDelete: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  timeOf: (iso: string) => string;
}) {
  const { t, tp, locale } = useI18n();
  if (!items.length) return <p className="text-sm text-slate-500 p-2">{t('Your consultations will appear here.')}</p>;
  return (
    <ul className="flex flex-col gap-1 min-h-0 overflow-hidden">
      {items.slice(0, 12).map((c) => (
        <li key={c.id} className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onOpen(c.id)}
            className={cn('flex-1 min-w-0 min-h-14 px-3 py-2 rounded-xl border text-left', c.id === activeId ? 'border-amber-400/50 bg-amber-400/10' : 'border-transparent active:bg-white/5')}
          >
            <span className="block text-sm text-slate-100 truncate">{c.title}</span>
            <span className="block text-[11px] font-mono text-slate-500">
              {new Date(c.updatedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })} · {timeOf(c.updatedAt)} · {tp(c.messageCount, 'message', 'messages')}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onDelete(c.id)}
            aria-label={confirmDelete === c.id ? t('Confirm deleting the consultation') : t('Delete consultation')}
            className={cn('h-11 w-11 shrink-0 rounded-lg flex items-center justify-center', confirmDelete === c.id ? 'bg-rose-500 text-white' : 'text-slate-500 active:bg-white/10')}
          >
            <Trash2 size={16} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ timeOf }: { timeOf: (iso: string) => string }) {
  const t = useI18n().t;
  return (
    <>
      <div className="self-center max-w-[90%] bg-amber-500/10 border border-dashed border-amber-400/60 text-amber-300 px-4 py-2 rounded-2xl text-[11px] font-mono text-center">
        {t('New consultation · saved to your account')}
      </div>
      <div className="self-start max-w-[92%] sm:max-w-[78%]">
        <MetaRow time={new Date().toISOString()} timeOf={timeOf} />
        <div className="px-4 py-3 text-base leading-relaxed bg-white/[0.06] border border-white/10 rounded-2xl rounded-tl-none markdown-body">
          <p>{t('Hello. I am {name}. Let’s not begin with the image yet — let’s begin with what deserves to stay with you on your skin.', { name: APP.assistantName })}</p>
          <p>{t('I can guide you from feeling and symbol through style, placement and how it will age, to a design you can open in the generator and a brief for your tattoo artist.')} <strong>{t('What brought you to ink today?')}</strong></p>
        </div>
      </div>
    </>
  );
}

function MetaRow({ time, steps, timeOf }: { time: string; steps?: ActivityStep[]; timeOf: (iso: string) => string }) {
  return (
    <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-500 flex-wrap">
      <span className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center">
        <Fingerprint size={12} />
      </span>
      <span className="font-mono">{APP.assistantName} · {timeOf(time)}</span>
      {steps && <ActivityChips steps={steps} />}
    </div>
  );
}

function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => {
          const safe = safeUrl(href);
          return safe ? <a href={safe} target="_blank" rel="noopener noreferrer">{children}</a> : <>{children}</>;
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

function MessageView({ message, timeOf, conversationId, canSpeak }: { message: ChatMessage; timeOf: (iso: string) => string; conversationId: string | null; canSpeak: boolean }) {
  const t = useI18n().t;
  const [copied, setCopied] = React.useState(false);
  if (message.role === 'user') {
    return (
      <div className="self-end max-w-[92%] sm:max-w-[78%] flex flex-col items-end gap-1.5">
        {Boolean(message.images?.length) && (
          <div className="flex gap-1.5 flex-wrap justify-end">
            {message.images!.map((id) => (
              <img key={id} src={chatImageUrl(id)} alt={t('Picture attached to the message')} className="w-32 h-32 rounded-xl object-cover bg-white/5 border border-orange-400/25" />
            ))}
          </div>
        )}
        <div className="px-4 py-3 text-base leading-relaxed bg-orange-400/10 border border-orange-400/25 rounded-2xl rounded-tr-none whitespace-pre-wrap break-words">{message.content}</div>
      </div>
    );
  }
  const shown = stripBlocks(message.content);
  const copy = () => {
    navigator.clipboard?.writeText(shown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="self-start max-w-[92%] sm:max-w-[78%]">
      <MetaRow time={message.createdAt} steps={message.steps} timeOf={timeOf} />
      <ActivityPanel steps={message.steps} />
      {message.content ? (
        shown && (
          <div className="mt-2 px-4 py-3 text-base leading-relaxed bg-white/[0.06] border border-white/10 rounded-2xl rounded-tl-none markdown-body break-words">
            <Markdown text={shown} />
            {message.status === 'partial' && <p className="text-xs font-mono text-amber-300">{t('(reply interrupted)')}</p>}
          </div>
        )
      ) : (
        <div className="px-4 py-3 text-sm font-mono text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-2xl rounded-tl-none">{t('No reply.')}</div>
      )}
      {message.brief && <DesignCard brief={message.brief} studioBrief={message.studioBrief ?? null} conversationId={conversationId} />}
      {message.studioBrief && <StudioBriefCard text={message.studioBrief} brief={message.brief ?? null} conversationId={conversationId} />}
      {shown && (
        <div className="mt-1 flex items-center gap-1">
          {canSpeak && <SpeakButton id={`chat-${message.id}`} text={shown.replace(/[*_#>`|]/g, '')} className="h-10 px-3 text-xs" />}
          <button type="button" onClick={copy} className="h-10 px-3 rounded-xl text-xs text-slate-400 flex items-center gap-1.5 active:bg-white/5">
            {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />} {copied ? t('Copied') : t('Copy')}
          </button>
        </div>
      )}
    </div>
  );
}

function DesignCard({ brief, studioBrief, conversationId }: { brief: DesignBrief; studioBrief: string | null; conversationId: string | null }) {
  const t = useI18n().t;
  const { optionSet, openGenerator } = useApp();
  const flagged = brief.culturalCheck === 'flagged';
  return (
    <div className="mt-2 p-4 rounded-2xl border border-pink-400/40 bg-pink-400/[0.07] space-y-3">
      <div className="flex items-center gap-2 text-pink-200 text-sm font-semibold">
        <Wand2 size={16} /> {t('Design specification')}
      </div>
      <p className="text-base text-white">{brief.subject}</p>
      <BriefChips brief={brief} set={optionSet} />
      {brief.notes && <p className="text-sm text-slate-300">{brief.notes}</p>}
      {flagged ? (
        <p className="text-sm text-amber-200 flex items-start gap-2">
          <ShieldAlert size={16} className="shrink-0 mt-0.5" /> {t('On hold: a symbol in this design belongs to a closed or sacred tradition. Resolve it with {name} first.', { name: APP.assistantName })}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => openGenerator({ brief, studioBrief, conversationId })}
          className="h-12 px-5 rounded-xl bg-pink-400 text-black font-semibold text-sm flex items-center gap-2 active:bg-pink-300"
        >
          <Wand2 size={16} /> {t('Open in generator')}
        </button>
      )}
    </div>
  );
}

function StudioBriefCard({ text, brief, conversationId }: { text: string; brief: DesignBrief | null; conversationId: string | null }) {
  const t = useI18n().t;
  const { openGenerator } = useApp();
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const copy = () => navigator.clipboard?.writeText(text).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  });
  return (
    <div className="mt-2 p-4 rounded-2xl border border-emerald-400/40 bg-emerald-400/[0.06] space-y-2">
      <div className="flex items-center gap-2 text-emerald-200 text-sm font-semibold">
        <ScrollText size={16} /> {t('Studio brief for your tattoo artist')}
      </div>
      <pre className={cn('whitespace-pre-wrap text-sm text-slate-200 font-sans', !open && 'line-clamp-4')}>{text}</pre>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className="h-10 px-3 rounded-xl border border-white/10 text-xs text-slate-200">
          {open ? t('Show less') : t('Read all')}
        </button>
        <button type="button" onClick={copy} className="h-10 px-3 rounded-xl border border-white/10 text-xs text-slate-200 flex items-center gap-1.5">
          {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />} {copied ? t('Copied') : t('Copy')}
        </button>
        {brief && (
          <button type="button" onClick={() => openGenerator({ brief, studioBrief: text, conversationId })} className="h-10 px-3 rounded-xl bg-emerald-400/15 border border-emerald-400/40 text-xs text-emerald-200 flex items-center gap-1.5">
            <Wand2 size={14} /> {t('Keep with the design')}
          </button>
        )}
      </div>
    </div>
  );
}

function DraftView({ draft }: { draft: Draft }) {
  const t = useI18n().t;
  const shown = stripBlocks(draft.content);
  return (
    <div className="self-start max-w-[92%] sm:max-w-[78%]">
      <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-500 flex-wrap">
        <span className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center">
          <Fingerprint size={12} />
        </span>
        <span className="font-mono">{APP.assistantName} · {t('now')}</span>
        <ActivityChips steps={draft.steps} live />
      </div>
      <ActivityPanel steps={draft.steps} live={!draft.content} />
      {shown ? (
        <div className="mt-2 px-4 py-3 text-base leading-relaxed bg-white/[0.06] border border-white/10 rounded-2xl rounded-tl-none markdown-body break-words">
          <Markdown text={shown} />
        </div>
      ) : (
        <div className="mt-2 px-4 py-3 bg-white/[0.06] border border-white/10 rounded-2xl rounded-tl-none flex items-center gap-3 min-w-0">
          <span className="flex gap-1 shrink-0">
            {[0, 0.2, 0.4].map((d) => (
              <span key={d} className="w-[7px] h-[7px] bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />
            ))}
          </span>
          <span className="text-[12px] font-mono text-amber-300/90 truncate">{draft.status}</span>
        </div>
      )}
      {shown && <p className="mt-1 text-[11px] font-mono text-amber-300/80 truncate">{draft.status}</p>}
      {draft.error && <p className="mt-2 text-sm text-rose-300 font-mono">{draft.error}</p>}
    </div>
  );
}

function Composer({
  input, setInput, sending, disabled, onSend, onStop, onPrompt, showPrompts, textareaRef, recorder, attachments, uploading, canAttach, onPickPhoto, onRemovePhoto,
}: {
  attachments: Attachment[];
  uploading: boolean;
  canAttach: boolean;
  onPickPhoto: () => void;
  onRemovePhoto: (id: string) => void;
  input: string;
  setInput: (v: string) => void;
  sending: boolean;
  disabled: boolean;
  onSend: () => void;
  onStop: () => void;
  onPrompt: (p: string) => void;
  showPrompts: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  recorder: ReturnType<typeof useVoiceMessage> | null;
}) {
  const t = useI18n().t;
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    el.style.overflowY = el.scrollHeight > 140 ? 'auto' : 'hidden';
  }, [input, textareaRef]);

  return (
    <div className="shrink-0 px-3 md:px-5 pt-3 pb-3 border-t border-white/5 bg-gradient-to-t from-black/60 to-transparent">
      {showPrompts && (
        <div className="flex flex-wrap gap-2 mb-3">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPrompt(p)}
              disabled={disabled}
              className="h-11 px-4 rounded-full border border-amber-400/30 text-amber-100 bg-amber-500/10 text-sm whitespace-nowrap font-medium disabled:opacity-40 max-w-full truncate"
            >
              {t(p)}
            </button>
          ))}
        </div>
      )}
      {recorder && recorder.state === 'processing' && <p className="mb-2 text-xs font-mono text-sky-200">{t('Gemini is listening to the recording…')}</p>}
      {recorder && recorder.state === 'error' && <p className="mb-2 text-xs font-mono text-rose-300">{recorder.error}</p>}
      {(attachments.length > 0 || uploading) && (
        <div className="flex gap-2 mb-2 items-center">
          {attachments.map((a) => (
            <div key={a.id} className="relative">
              <img src={a.preview} alt={t('Attached picture')} className="w-16 h-16 rounded-xl object-cover border border-white/10" />
              <button
                type="button"
                onClick={() => onRemovePhoto(a.id)}
                aria-label={t('Remove picture')}
                className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-black border border-white/20 text-slate-200 flex items-center justify-center after:absolute after:-inset-1.5 after:content-['']"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {uploading && (
            <span className="w-16 h-16 rounded-xl border border-dashed border-white/20 text-slate-400 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin" />
            </span>
          )}
          <span className="text-xs font-mono text-slate-500">{attachments.length}/{MAX_IMAGES} · {t('reference pictures go to Ötzi with the message')}</span>
        </div>
      )}
      <div className="flex gap-2 items-end bg-white/5 border border-white/10 rounded-2xl px-3 py-2 focus-within:border-amber-400/60 transition-all">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={1}
          placeholder={t('Tell Ötzi what is on your mind…')}
          aria-label={t('Message to Ötzi')}
          className="flex-1 bg-transparent outline-none text-base text-white resize-none min-h-12 max-h-[140px] py-3 leading-relaxed placeholder:text-slate-500"
        />
        {canAttach && (
          <button
            type="button"
            onClick={onPickPhoto}
            disabled={disabled || uploading || attachments.length >= MAX_IMAGES}
            aria-label={t('Add a reference picture')}
            className="h-12 w-12 shrink-0 rounded-xl bg-white/5 border border-white/10 text-amber-200 flex items-center justify-center disabled:opacity-40 active:bg-white/10"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
          </button>
        )}
        {recorder && <RecordButton recorder={recorder} compact className="h-12 w-12 px-0 shrink-0" />}
        {sending ? (
          <button type="button" onClick={onStop} aria-label={t('Stop')} className="h-12 w-12 shrink-0 rounded-xl bg-rose-500/80 text-white flex items-center justify-center">
            <Square size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={(!input.trim() && !attachments.length) || disabled || uploading}
            aria-label={t('Send')}
            className="h-12 w-12 shrink-0 rounded-xl bg-amber-400 text-black flex items-center justify-center disabled:opacity-40 active:scale-95"
          >
            <Send size={18} />
          </button>
        )}
      </div>
      <p className="mt-2 text-[11px] font-mono text-slate-500 text-center">{t('Ötzi is an AI design guide, not a tattoo artist or a doctor · every design must be reviewed by a licensed professional')}</p>
    </div>
  );
}

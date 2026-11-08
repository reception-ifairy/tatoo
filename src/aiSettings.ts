// AI provider settings shared by the server (storage, routing) and the client (Settings UI).

import type { Effort } from './config';
import { DEFAULT_EDIT_MODEL, DEFAULT_IMAGE_MODEL, DEFAULT_SAMPLE_MODEL } from './imageModels';

/** Text engines (the consultation chat and structured calls). */
export type Provider = 'anthropic' | 'openai' | 'google';

export const PROVIDER_IDS: Provider[] = ['anthropic', 'openai', 'google'];

/** Everything that can hold an API key: the text engines plus image-only providers. */
export type KeyProvider = Provider | 'replicate' | 'stability';

export const KEY_PROVIDER_IDS: KeyProvider[] = ['anthropic', 'openai', 'google', 'replicate', 'stability'];

export const PROVIDER_INFO: Record<KeyProvider, { label: string; company: string; keyPlaceholder: string; keyUrl: string; engineNote: string }> = {
  anthropic: {
    label: 'Claude',
    company: 'Anthropic',
    keyPlaceholder: 'sk-ant-…',
    keyUrl: 'console.anthropic.com → API Keys',
    engineNote: 'The most careful consultation with Ötzi: thorough, nuanced answers. Slower and pricier.',
  },
  openai: {
    label: 'GPT',
    company: 'OpenAI',
    keyPlaceholder: 'sk-…',
    keyUrl: 'platform.openai.com → API keys',
    engineNote: 'Quick, capable consultation with Ötzi; a good alternative to compare answers.',
  },
  google: {
    label: 'Gemini',
    company: 'Google',
    keyPlaceholder: 'AIza…',
    keyUrl: 'aistudio.google.com → Get API key',
    engineNote: 'Fast and inexpensive consultation with Ötzi. This key also powers voice and voice messages.',
  },
  replicate: {
    label: 'FLUX',
    company: 'Replicate',
    keyPlaceholder: 'r8_…',
    keyUrl: 'replicate.com → Account settings → API tokens',
    engineNote: 'Images only: FLUX (Schnell, 1.1 Pro, Ultra, 2 Pro, 3).',
  },
  stability: {
    label: 'Stable Image',
    company: 'Stability AI',
    keyPlaceholder: 'sk-…',
    keyUrl: 'platform.stability.ai → Account → API keys',
    engineNote: 'Images only: SD3.5 and Stable Image Core / Ultra.',
  },
};

export interface ModelInfo {
  id: string;
  label: string;
  /** image = an image model the key can reach (matched against src/imageModels.ts). */
  kind: 'text' | 'tts' | 'image';
}

export type KeyStatus = 'untested' | 'ok' | 'error';

export interface ProviderStatus {
  configured: boolean;
  /** db = saved in Settings, env = ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY on the server. */
  source: 'db' | 'env' | null;
  hint: string | null;
  status: KeyStatus;
  message: string | null;
  testedAt: string | null;
  models: ModelInfo[];
}

export interface AiPrefs {
  engine: { provider: Provider; models: Record<Provider, string> };
  effort: Effort;
  voice: { voiceName: string; ttsModel: string; autoRead: boolean };
  stt: { model: string };
  /** Image models: catalogue ids from src/imageModels.ts. Detected models are on unless listed in `disabled`. */
  image: { defaultModel: string; sampleModel: string; editModel: string; disabled: string[] };
}

export interface AiSettings {
  providers: Record<KeyProvider, ProviderStatus>;
  prefs: AiPrefs;
  storage: 'mysql' | 'file';
}

export const DEFAULT_PREFS: AiPrefs = {
  engine: {
    provider: 'anthropic',
    models: { anthropic: 'claude-opus-5-5', openai: 'gpt-6.1-sol', google: 'gemini-3.8-flash' },
  },
  effort: 'medium',
  voice: { voiceName: 'Charon', ttsModel: 'gemini-3.8-flash-tts', autoRead: false },
  stt: { model: 'gemini-3.8-flash' },
  image: { defaultModel: DEFAULT_IMAGE_MODEL, sampleModel: DEFAULT_SAMPLE_MODEL, editModel: DEFAULT_EDIT_MODEL, disabled: [] },
};

// Gemini TTS prebuilt voices with a lower, male timbre. Descriptions follow Google's voice list.
export const MALE_VOICES: { id: string; label: string }[] = [
  { id: 'Charon', label: 'Charon — informative, low (default)' },
  { id: 'Algenib', label: 'Algenib — gravelly, mature' },
  { id: 'Orus', label: 'Orus — firm' },
  { id: 'Rasalgethi', label: 'Rasalgethi — calm, informative' },
  { id: 'Schedar', label: 'Schedar — even, composed' },
  { id: 'Sadaltager', label: 'Sadaltager — knowledgeable' },
  { id: 'Alnilam', label: 'Alnilam — confident, firm' },
  { id: 'Iapetus', label: 'Iapetus — clear' },
  { id: 'Algieba', label: 'Algieba — smooth, warm' },
  { id: 'Enceladus', label: 'Enceladus — soft, breathy' },
];

/** Result of a recorded voice message after Gemini listened to it. */
export interface VoiceQuery {
  transcript: string;
  /** The request in one sentence, in the spoken language, ready for the chat box. */
  query: string;
}

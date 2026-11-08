// Conversation types and the SSE events streamed by POST /api/chat.

import type { ActivityStep, SourceLink } from './types';
import type { DesignBrief } from './design';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: SourceLink[];
  steps: ActivityStep[];
  images?: string[]; // ids of photos attached by the admin (/api/chat/images/:id); clients can't attach photos
  status: 'complete' | 'partial' | 'error';
  createdAt: string;
  /** A design_spec Ötzi wrote in this reply, already matched to the generator's options. */
  brief?: DesignBrief | null;
  /** A studio_brief Ötzi wrote in this reply (plain text for the tattoo artist). */
  studioBrief?: string | null;
}

export interface ConversationSummary {
  id: string;
  ownerId?: string;
  title: string;
  messageCount: number;
  updatedAt: string;
}

export interface Conversation extends ConversationSummary {
  messages: ChatMessage[];
}

export type ChatEvent =
  | { type: 'conversation'; id: string; title: string; userMessageId: string; content: string; images: string[] }
  | { type: 'status'; text: string }
  | { type: 'activity'; step: ActivityStep }
  | { type: 'delta'; text: string }
  | { type: 'sources'; items: SourceLink[] }
  | { type: 'saved'; messageId: string; status: ChatMessage['status']; brief: DesignBrief | null; studioBrief: string | null }
  | { type: 'fail'; message: string }
  | { type: 'done' };

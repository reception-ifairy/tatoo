import type { OptionPicks } from './options';
import type { OutputKind } from './account';

// Designs and projects. A project is one tattoo idea of one person: its brief (subject + picks), the pictures made
// from it, and for the scar cover-up service the cropped photo (deleted when the project is completed).

export type CulturalCheck = 'clear' | 'inspired_not_copied' | 'flagged';

export interface DesignBrief {
  /** The motif in the client's words, in English or Polish (the prompt is always built in English). */
  subject: string;
  picks: OptionPicks;
  /** Extra notes for the design ("make the wings taller"). */
  notes: string;
  culturalCheck: CulturalCheck;
}

export interface DesignImage {
  id: string;
  kind: OutputKind;
  /** Served at /api/projects/:projectId/images/:id */
  mime: string;
  model: string;
  /** Admin only; never sent to clients. */
  costUsd?: number;
  prompt?: string;
  /** Made from the client's scar photo, so it is deleted with it. */
  fromPhoto: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  ownerId: string;
  title: string;
  type: 'design' | 'scar';
  status: 'open' | 'done';
  brief: DesignBrief;
  images: DesignImage[];
  /** Scar service: the cropped photo, or null once deleted. */
  photo: { mime: string; uploadedAt: string } | null;
  /** The studio brief Ötzi wrote in the consultation, if the design came from there. */
  studioBrief: string | null;
  conversationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProjectSummary = Pick<Project, 'id' | 'title' | 'type' | 'status' | 'updatedAt' | 'createdAt'> & {
  cover: string | null;
  imageCount: number;
  /** Admin listing: who it belongs to (an alias for scar projects, which stay anonymous). */
  owner?: string;
};

/** A warning the generator shows before making a picture (translated on the client). */
export interface DesignWarning {
  code: 'fine_line_movement' | 'closed_culture' | 'sensitive_culture' | 'high_visibility' | 'stencil_palette';
  vars: Record<string, string>;
}

/** POST /api/projects/:id/estimate */
export interface GenerationEstimate {
  kind: OutputKind;
  prompt: string;
  aspect: string;
  warnings: DesignWarning[];
  model: { id: string; label: string } | null;
  /** Admin only. */
  costUsd: number | null;
  /** Clients: how many pictures of this kind are left in the package. */
  remaining: number | null;
  /** Mannequin previews can carry the project's latest design as a reference picture. */
  usesReference: boolean;
  blocker: string | null;
}

export const EMPTY_BRIEF: DesignBrief = { subject: '', picks: {}, notes: '', culturalCheck: 'clear' };

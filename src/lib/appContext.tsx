import React from 'react';
import type { PublicUser } from '../account';
import type { Compendium } from '../compendium';
import type { DesignBrief } from '../design';
import type { OptionSet } from '../options';
import type { ViewId } from './sections';

// What every view can reach: the signed-in user (with package and usage), the compendium, and the cross-view
// actions (open a design in the generator, open a project, start a consultation).

export interface GeneratorRequest {
  nonce: number;
  /** Open this saved project. */
  projectId?: string;
  /** Start a new design from this brief (from a consultation or the atlas). */
  brief?: DesignBrief;
  /** Merge these picks into the design that is open (atlas: "Use this style"). */
  picks?: Record<string, string>;
  studioBrief?: string | null;
  conversationId?: string | null;
}

export interface AppContextValue {
  user: PublicUser;
  refreshUser: () => void;
  compendium: Compendium | null;
  /** The tattoo option set (groups and options of the generator), with thumbnails. */
  optionSet: OptionSet | null;
  setOptionSet: (set: OptionSet) => void;
  navigate: (view: ViewId) => void;
  openGenerator: (request: Omit<GeneratorRequest, 'nonce'>) => void;
  openScar: (projectId?: string) => void;
  startChat: (message: string) => void;
  /** Bumped whenever a project changes, so lists reload. */
  projectsVersion: number;
  projectsChanged: () => void;
  openSettings: () => void;
}

export const AppContext = React.createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = React.useContext(AppContext);
  if (!ctx) throw new Error('useApp outside AppContext');
  return ctx;
}

import type { Lang } from './i18n';

// Accounts and packages, shared by the server (limits, storage) and the client (package cards, admin panel).
// One super admin (credentials in .env) and any number of clients the admin creates. Clients don't pay in the
// app: the admin gives each one a package, and every generation counts against that package's limits.

export type Role = 'admin' | 'client';

/** What a generation produces. Each kind has its own counter in a package. */
export type OutputKind = 'stencil' | 'colour' | 'mannequin' | 'scar';

export const OUTPUT_KINDS: OutputKind[] = ['stencil', 'colour', 'mannequin', 'scar'];

export type Usage = Record<OutputKind, number>;

export const ZERO_USAGE: Usage = { stencil: 0, colour: 0, mannequin: 0, scar: 0 };

export interface PackageDef {
  id: string;
  name: string;
  description: string;
  /** Consultation with the assistant (chat). */
  consultation: boolean;
  /** Per-kind generation limits. 0 = not included. `scar` > 0 also unlocks the scar cover-up service. */
  limits: Usage;
}

/** Shown to a client and in the admin panel: everything a package includes, with what is left. */
export interface PublicUser {
  id: string;
  login: string;
  displayName: string;
  role: Role;
  lang: Lang;
  /** Clients only. */
  packageId: string | null;
  package: PackageDef | null;
  usage: Usage;
  active: boolean;
  createdAt: string;
}

/** The starter packages, created on first run. The admin can rename them and change every limit. */
export const DEFAULT_PACKAGES: PackageDef[] = [
  {
    id: 'sketch',
    name: 'Sketch',
    description: 'Talk your idea through with Ötzi and take home clean line stencils.',
    consultation: true,
    limits: { stencil: 3, colour: 0, mannequin: 0, scar: 0 },
  },
  {
    id: 'studio',
    name: 'Studio',
    description: 'The full design path: stencils, finished colour designs and previews on a neutral mannequin.',
    consultation: true,
    limits: { stencil: 10, colour: 10, mannequin: 5, scar: 0 },
  },
  {
    id: 'full',
    name: 'Full',
    description: 'Everything in Studio with more room to iterate, plus the private scar cover-up service.',
    consultation: true,
    limits: { stencil: 30, colour: 30, mannequin: 15, scar: 10 },
  },
];

/** Generous ceiling used for the admin, who is never limited. */
export const UNLIMITED = Number.MAX_SAFE_INTEGER;

export function remaining(user: Pick<PublicUser, 'role' | 'package' | 'usage'>, kind: OutputKind): number {
  if (user.role === 'admin') return UNLIMITED;
  if (!user.package) return 0;
  return Math.max(0, user.package.limits[kind] - (user.usage[kind] ?? 0));
}

export function canConsult(user: Pick<PublicUser, 'role' | 'package'>): boolean {
  return user.role === 'admin' || Boolean(user.package?.consultation);
}

export function hasScarService(user: Pick<PublicUser, 'role' | 'package'>): boolean {
  return user.role === 'admin' || (user.package?.limits.scar ?? 0) > 0;
}

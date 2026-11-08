import type { PackageDef, PublicUser, OutputKind } from '../account';
import type { Article, Compendium } from '../compendium';
import type { DesignBrief, GenerationEstimate, Project, ProjectSummary, DesignImage } from '../design';
import type { ProgressEvent } from '../types';
import { streamRequest } from './api';
import { notifySessionExpired } from './utils';

// Client for the app's own JSON endpoints (server.ts, server/projects.ts, server/adminRoutes.ts).

export async function call<T>(method: string, url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (res.status === 401) notifySessionExpired();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Server error (${res.status}).`);
  return data as T;
}

export const api = {
  me: () => call<{ user: PublicUser }>('GET', '/api/me').then((r) => r.user),
  setLang: (lang: 'en' | 'pl') => call<{ user: PublicUser }>('PUT', '/api/me/lang', { lang }).then((r) => r.user),
  compendium: () => call<Compendium>('GET', '/api/compendium'),
  article: (slug: string) => call<{ article: Article; body: string }>('GET', `/api/library/${encodeURIComponent(slug)}`),

  projects: (all = false) => call<ProjectSummary[]>('GET', `/api/projects${all ? '?all=1' : ''}`),
  project: (id: string) => call<Project>('GET', `/api/projects/${id}`),
  createProject: (body: { brief?: DesignBrief; type?: 'design' | 'scar'; title?: string; studioBrief?: string | null; conversationId?: string | null }) =>
    call<Project>('POST', '/api/projects', body),
  patchProject: (id: string, patch: { title?: string; brief?: DesignBrief; status?: 'open' | 'done'; studioBrief?: string }) => call<Project>('PATCH', `/api/projects/${id}`, patch),
  deleteProject: (id: string) => call<{ ok: true }>('DELETE', `/api/projects/${id}`),
  estimate: (id: string, kind: OutputKind) => call<GenerationEstimate>('POST', `/api/projects/${id}/estimate`, { kind }),
  /** PAID: one picture. The admin sends back the cost they saw; a client spends one from the package. */
  generate: (id: string, kind: OutputKind, confirmedUsd: number | null, onProgress: (e: ProgressEvent) => void, signal: AbortSignal) =>
    streamRequest<{ project: Project; image: DesignImage }>(`/api/projects/${id}/generate`, { kind, confirmedUsd }, onProgress, signal),
  uploadPhoto: async (id: string, blob: Blob) => {
    const res = await fetch(`/api/projects/${id}/photo?consent=1`, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': blob.type }, body: blob });
    if (res.status === 401) notifySessionExpired();
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Server error (${res.status}).`);
    return data as Project;
  },
  deletePhoto: (id: string) => call<Project>('DELETE', `/api/projects/${id}/photo`),

  clients: () => call<PublicUser[]>('GET', '/api/admin/clients'),
  createClient: (body: { login: string; displayName: string; password: string; packageId: string }) => call<PublicUser>('POST', '/api/admin/clients', body),
  updateClient: (id: string, patch: { displayName?: string; password?: string; packageId?: string; active?: boolean; resetUsage?: boolean }) =>
    call<PublicUser>('PATCH', `/api/admin/clients/${id}`, patch),
  deleteClient: (id: string) => call<{ ok: true }>('DELETE', `/api/admin/clients/${id}`),
  packages: () => call<PackageDef[]>('GET', '/api/admin/packages'),
  savePackages: (packages: PackageDef[]) => call<PackageDef[]>('PUT', '/api/admin/packages', { packages }),
};

export const imageUrl = (projectId: string, imageId: string, download = false) => `/api/projects/${projectId}/images/${imageId}${download ? '?download=1' : ''}`;

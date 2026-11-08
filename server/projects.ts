import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express from 'express';
import sharp from 'sharp';
import { OUTPUT_KINDS, hasScarService, remaining, type OutputKind, type PublicUser } from '../src/account';
import type { DesignBrief, DesignImage, GenerationEstimate, Project, ProjectSummary } from '../src/design';
import { EMPTY_BRIEF } from '../src/design';
import { imagePrice, type ImageModelDef } from '../src/imageModels';
import type { StreamEvent } from '../src/types';
import type { SettingsStore } from './store';
import type { ProviderService } from './providers';
import { ADMIN_ID, type UserService } from './users';
import { currentUser, isAdmin } from './auth';
import { composeDesignPrompt, composeScarPrompt, titleFromBrief } from './designPrompt';
import { tattooSet } from './tattooSet';
import { generateImage, supportsReferences } from './images/generate';
import { ResearchError, toHttpError } from './errors';

// Projects: one tattoo idea per project, with the pictures made from it. Stored per owner as a document
// (`projects_<userId>`); pictures and the scar photo are files in data/projects/<projectId>/.
//
// Paid calls: the admin sees the cost and must send it back (confirmedUsd, like the template's thumbnail run);
// a client spends one picture from their package — the package is the admin's standing consent. A failed
// picture is given back to the package.
//
// Scar cover-up: the only place a client uploads a photo. The client crops it to the scar in the browser; here it
// is re-encoded (which drops EXIF/GPS and every other metadata), kept with the project, and deleted — together
// with every picture made from it — when the project is completed, or earlier on request.

const MAX_PROJECTS = 200;
const PHOTO_MAX_PX = 1536;
const ID = /^[0-9a-f-]{36}$/;

export type GenerationResult = { project: Project; image: DesignImage };

function cleanBrief(raw: unknown): DesignBrief {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Partial<DesignBrief>;
  const set = tattooSet();
  const picks: Record<string, string> = {};
  if (b.picks && typeof b.picks === 'object') {
    for (const g of set.groups) {
      const v = (b.picks as Record<string, unknown>)[g.id];
      if (typeof v === 'string' && g.options.some((o) => o.code === v)) picks[g.id] = v;
    }
  }
  const cc = b.culturalCheck;
  return {
    subject: typeof b.subject === 'string' ? b.subject.replace(/\s+/g, ' ').trim().slice(0, 400) : '',
    picks,
    notes: typeof b.notes === 'string' ? b.notes.replace(/\s+/g, ' ').trim().slice(0, 400) : '',
    culturalCheck: cc === 'flagged' || cc === 'inspired_not_copied' ? cc : 'clear',
  };
}

/** What a client may see: no costs, no prompts. */
function forUser(p: Project, user: PublicUser): Project {
  if (user.role === 'admin') return p;
  return { ...p, images: p.images.map(({ costUsd: _c, prompt: _p, ...img }) => img) };
}

export class ProjectService {
  private dir: string;
  private writes = new Map<string, Promise<unknown>>();
  private running = new Set<string>();

  constructor(
    private store: SettingsStore,
    private providers: ProviderService,
    private users: UserService,
    appDir: string,
  ) {
    this.dir = path.join(appDir, 'data', 'projects');
  }

  private docName = (ownerId: string) => `projects_${ownerId}`;

  private async list(ownerId: string): Promise<Project[]> {
    const doc = await this.store.getDoc(this.docName(ownerId));
    return Array.isArray(doc.projects) ? (doc.projects as Project[]) : [];
  }

  /** Serialised read-modify-write per owner. */
  private update<T>(ownerId: string, fn: (list: Project[]) => Promise<T> | T): Promise<T> {
    const prev = this.writes.get(ownerId) ?? Promise.resolve();
    const next = prev.then(async () => {
      const list = await this.list(ownerId);
      const result = await fn(list);
      await this.store.saveDoc(this.docName(ownerId), { projects: list });
      return result;
    });
    this.writes.set(ownerId, next.catch(() => undefined));
    return next;
  }

  private owners = async () => [ADMIN_ID, ...(await this.users.listClients()).map((c) => c.id)];

  /** The project if the user may see it (their own; the admin sees every project). */
  async find(id: string, user: PublicUser): Promise<Project | null> {
    if (!ID.test(id)) return null;
    const own = (await this.list(user.id)).find((p) => p.id === id);
    if (own) return own;
    if (user.role !== 'admin') return null;
    for (const owner of await this.owners()) {
      const p = (await this.list(owner)).find((x) => x.id === id);
      if (p) return p;
    }
    return null;
  }

  private async summary(p: Project, owner?: string): Promise<ProjectSummary> {
    const cover = [...p.images].reverse().find((i) => i.kind !== 'stencil') ?? p.images[p.images.length - 1];
    return {
      id: p.id, title: p.title, type: p.type, status: p.status, createdAt: p.createdAt, updatedAt: p.updatedAt,
      cover: cover ? `/api/projects/${p.id}/images/${cover.id}` : null,
      imageCount: p.images.length,
      ...(owner ? { owner } : {}),
    };
  }

  async summaries(user: PublicUser, all: boolean): Promise<ProjectSummary[]> {
    const owners = all && user.role === 'admin' ? await this.owners() : [user.id];
    const out: ProjectSummary[] = [];
    for (const owner of owners) {
      const name = all ? await this.users.nameOf(owner) : undefined;
      const alias = all ? await this.users.aliasOf(owner) : undefined;
      for (const p of await this.list(owner)) out.push(await this.summary(p, all ? (p.type === 'scar' ? alias : name) : undefined));
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  create(user: PublicUser, input: { brief?: unknown; type?: unknown; title?: unknown; studioBrief?: unknown; conversationId?: unknown }): Promise<Project> {
    const type = input.type === 'scar' ? 'scar' : 'design';
    if (type === 'scar' && !hasScarService(user)) throw new ResearchError('The scar cover-up service is not part of your package.', 403);
    const brief = cleanBrief(input.brief ?? EMPTY_BRIEF);
    const now = new Date().toISOString();
    const project: Project = {
      id: crypto.randomUUID(),
      ownerId: user.id,
      title: typeof input.title === 'string' && input.title.trim() ? input.title.trim().slice(0, 80) : type === 'scar' ? 'Scar cover-up' : titleFromBrief(brief),
      type,
      status: 'open',
      brief,
      images: [],
      photo: null,
      studioBrief: typeof input.studioBrief === 'string' ? input.studioBrief.slice(0, 6000) : null,
      conversationId: typeof input.conversationId === 'string' ? input.conversationId.slice(0, 64) : null,
      createdAt: now,
      updatedAt: now,
    };
    return this.update(user.id, (list) => {
      if (list.length >= MAX_PROJECTS) throw new ResearchError('You have reached the project limit. Delete an old project first.', 400);
      list.push(project);
      return project;
    });
  }

  async patch(id: string, user: PublicUser, patch: { title?: unknown; brief?: unknown; status?: unknown; studioBrief?: unknown }): Promise<Project> {
    const found = await this.find(id, user);
    if (!found) throw new ResearchError('Project not found.', 404);
    const completing = patch.status === 'done' && found.status !== 'done';
    const updated = await this.update(found.ownerId, (list) => {
      const p = list.find((x) => x.id === id);
      if (!p) throw new ResearchError('Project not found.', 404);
      if (typeof patch.title === 'string' && patch.title.trim()) p.title = patch.title.trim().slice(0, 80);
      if (patch.brief !== undefined) p.brief = cleanBrief(patch.brief);
      if (typeof patch.studioBrief === 'string') p.studioBrief = patch.studioBrief.slice(0, 6000);
      if (patch.status === 'open' || patch.status === 'done') p.status = patch.status;
      if (completing) {
        p.photo = null;
        p.images = p.images.filter((i) => !i.fromPhoto);
      }
      p.updatedAt = new Date().toISOString();
      return p;
    });
    if (completing) this.deletePhotoFiles(found);
    return updated;
  }

  /** Deletes the scar photo and every picture made from it. */
  async deletePhoto(id: string, user: PublicUser): Promise<Project> {
    const found = await this.find(id, user);
    if (!found) throw new ResearchError('Project not found.', 404);
    const updated = await this.update(found.ownerId, (list) => {
      const p = list.find((x) => x.id === id)!;
      p.photo = null;
      p.images = p.images.filter((i) => !i.fromPhoto);
      p.updatedAt = new Date().toISOString();
      return p;
    });
    this.deletePhotoFiles(found);
    return updated;
  }

  private deletePhotoFiles(p: Project) {
    const dir = path.join(this.dir, p.id);
    fs.rmSync(path.join(dir, 'photo.jpg'), { force: true });
    for (const img of p.images.filter((i) => i.fromPhoto)) fs.rmSync(path.join(dir, `${img.id}.png`), { force: true });
  }

  async remove(id: string, user: PublicUser): Promise<void> {
    const found = await this.find(id, user);
    if (!found) throw new ResearchError('Project not found.', 404);
    await this.update(found.ownerId, (list) => {
      const i = list.findIndex((x) => x.id === id);
      if (i >= 0) list.splice(i, 1);
    });
    fs.rmSync(path.join(this.dir, found.id), { recursive: true, force: true });
  }

  /** Everything of one owner (used when the admin deletes a client): projects, pictures and photos. */
  async removeOwner(ownerId: string): Promise<void> {
    const list = await this.list(ownerId);
    for (const p of list) fs.rmSync(path.join(this.dir, p.id), { recursive: true, force: true });
    await this.update(ownerId, (l) => {
      l.splice(0, l.length);
    });
  }

  async savePhoto(id: string, user: PublicUser, data: Buffer): Promise<Project> {
    const found = await this.find(id, user);
    if (!found) throw new ResearchError('Project not found.', 404);
    if (found.ownerId !== user.id) throw new ResearchError('Only the owner of the project can add its photo.', 403);
    if (found.type !== 'scar') throw new ResearchError('Photos can only be added to a scar cover-up project.', 400);
    if (found.status === 'done') throw new ResearchError('This project is completed.', 400);
    let jpeg: Buffer;
    try {
      // .rotate() applies the EXIF orientation; the output carries no metadata at all (no EXIF, no GPS).
      jpeg = await sharp(data, { limitInputPixels: 40_000_000 }).rotate().resize(PHOTO_MAX_PX, PHOTO_MAX_PX, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
    } catch {
      throw new ResearchError('This photo could not be read (JPEG, PNG or WebP up to 8 MB).', 400);
    }
    const dir = path.join(this.dir, found.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'photo.jpg'), jpeg, { mode: 0o600 });
    return this.update(found.ownerId, (list) => {
      const p = list.find((x) => x.id === id)!;
      p.photo = { mime: 'image/jpeg', uploadedAt: new Date().toISOString() };
      p.updatedAt = p.photo.uploadedAt;
      return p;
    });
  }

  photoFile(p: Project): string | null {
    const f = path.join(this.dir, p.id, 'photo.jpg');
    return p.photo && fs.existsSync(f) ? f : null;
  }

  imageFile(p: Project, imageId: string): string | null {
    const img = p.images.find((i) => i.id === imageId);
    if (!img) return null;
    const f = path.join(this.dir, p.id, `${img.id}.png`);
    return fs.existsSync(f) ? f : null;
  }

  /** Which model, prompt and cost a picture of `kind` would use for this project right now. */
  async plan(p: Project, user: PublicUser, kind: OutputKind): Promise<{ estimate: GenerationEstimate; model: ImageModelDef | null; apiKey: string | null; references: { data: Buffer; mime: string }[]; fromPhoto: boolean }> {
    const prefs = await this.providers.getPrefs();
    let blocker: string | null = null;
    let references: { data: Buffer; mime: string }[] = [];
    let fromPhoto = false;

    // Mannequin: carry the latest finished design (colour first, then stencil) when the edit model is available.
    let modelId = prefs.image.defaultModel;
    let usesReference = false;
    if (kind === 'scar') {
      modelId = prefs.image.editModel;
      const photo = this.photoFile(p);
      if (p.type !== 'scar') blocker = 'Scar cover-ups are made in a scar cover-up project.';
      else if (!photo) blocker = 'Add the cropped photo of the scar first.';
      else {
        references = [{ data: fs.readFileSync(photo), mime: 'image/jpeg' }];
        usesReference = true;
        fromPhoto = true;
      }
    } else if (kind === 'mannequin') {
      const design = [...p.images].reverse().find((i) => i.kind === 'colour') ?? [...p.images].reverse().find((i) => i.kind === 'stencil');
      const file = design ? this.imageFile(p, design.id) : null;
      const edit = await this.providers.resolveImageModel(prefs.image.editModel);
      if (file && !('error' in edit)) {
        modelId = prefs.image.editModel;
        references = [{ data: fs.readFileSync(file), mime: 'image/png' }];
        usesReference = true;
      }
    }
    if (p.brief.culturalCheck === 'flagged') blocker = 'This design is on hold: its cultural check is "flagged". Resolve the symbol with Ötzi first.';
    if (p.status === 'done') blocker = 'This project is completed. Reopen it to make new pictures.';
    if (kind !== 'scar' && !p.brief.subject.trim() && !p.brief.picks.style) blocker = blocker ?? 'Describe the motif or choose a style first.';
    if (kind === 'scar' && !hasScarService(user)) blocker = 'The scar cover-up service is not part of your package.';

    const composed = kind === 'scar' ? composeScarPrompt(p.brief) : composeDesignPrompt(kind, p.brief, { withReference: usesReference });
    const resolved = await this.providers.resolveImageModel(modelId);
    const model = 'error' in resolved ? null : resolved.model;
    if ('error' in resolved) blocker = blocker ?? (user.role === 'admin' ? resolved.error : 'Picture generation is not available right now. Please ask the studio.');
    else if (references.length && !supportsReferences(resolved.model)) blocker = blocker ?? 'The edit model must be an OpenAI or Gemini model (Settings → Images).';
    const left = remaining(user, kind);
    if (user.role !== 'admin' && left <= 0) blocker = blocker ?? 'Your package has no pictures of this kind left. Ask the studio to extend it.';
    const tier = model?.sizing.kind === 'tier' ? model.sizing.defaultTier : undefined;
    const costUsd = model ? Math.round(imagePrice(model, tier) * 10000) / 10000 : 0;
    return {
      estimate: {
        kind,
        prompt: user.role === 'admin' ? composed.prompt : '',
        aspect: composed.aspect,
        warnings: composed.warnings,
        model: model ? { id: model.id, label: model.label } : null,
        costUsd: user.role === 'admin' ? costUsd : null,
        remaining: user.role === 'admin' ? null : left,
        usesReference,
        blocker,
      },
      model,
      apiKey: 'error' in resolved ? null : resolved.apiKey,
      references,
      fromPhoto,
    };
  }

  async generate(id: string, user: PublicUser, kind: OutputKind, confirmedUsd: number | null, onEvent: (e: StreamEvent<GenerationResult>) => void, signal: AbortSignal): Promise<GenerationResult> {
    const p = await this.find(id, user);
    if (!p) throw new ResearchError('Project not found.', 404);
    if (p.ownerId !== user.id && user.role !== 'admin') throw new ResearchError('Project not found.', 404);
    const plan = await this.plan(p, user, kind);
    if (plan.estimate.blocker) throw new ResearchError(plan.estimate.blocker, 400);
    if (!plan.model || !plan.apiKey) throw new ResearchError('No image model.', 400);
    if (user.role === 'admin') {
      if (confirmedUsd === null) throw new ResearchError('Check and confirm the cost first.', 400);
      if (Math.abs((plan.estimate.costUsd ?? 0) - confirmedUsd) >= 0.00005) {
        throw new ResearchError('The cost changed since you confirmed it (another model or tier). Check the cost again.', 409);
      }
    }
    if (this.running.has(p.id)) throw new ResearchError('A picture for this project is already being made.', 409);
    this.running.add(p.id);
    const giveBack = await this.users.consume(user.id, kind).catch((err) => {
      this.running.delete(p.id);
      throw err;
    });
    try {
      onEvent({ type: 'status', message: `Drawing with ${plan.model.label}…` });
      const composed = kind === 'scar' ? composeScarPrompt(p.brief) : composeDesignPrompt(kind, p.brief, { withReference: plan.estimate.usesReference });
      const tier = plan.model.sizing.kind === 'tier' ? plan.model.sizing.defaultTier : undefined;
      let image;
      try {
        image = await generateImage({ model: plan.model, apiKey: plan.apiKey, prompt: composed.prompt, aspect: composed.aspect, tier, signal, references: plan.references });
      } catch (err) {
        await giveBack();
        throw err;
      }
      const png = kind === 'stencil' ? await toTransparentStencil(image.data) : await sharp(image.data).png().toBuffer();
      const img: DesignImage = {
        id: crypto.randomUUID(),
        kind,
        mime: 'image/png',
        model: plan.model.label,
        costUsd: image.costUsd,
        prompt: composed.prompt,
        fromPhoto: plan.fromPhoto,
        createdAt: new Date().toISOString(),
      };
      const dir = path.join(this.dir, p.id);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${img.id}.png`), png, { mode: 0o600 });
      const project = await this.update(p.ownerId, (list) => {
        const x = list.find((y) => y.id === p.id);
        if (!x) throw new ResearchError('Project not found.', 404);
        x.images.push(img);
        x.updatedAt = img.createdAt;
        return x;
      });
      return { project: forUser(project, user), image: forUser({ ...project, images: [img] }, user).images[0] };
    } finally {
      this.running.delete(p.id);
    }
  }
}

/**
 * Black linework on white -> black linework on a transparent background: alpha follows darkness, so anti-aliased
 * edges stay smooth and the paper disappears. Ready to print or drop onto a photo.
 */
export async function toTransparentStencil(data: Buffer): Promise<Buffer> {
  const { data: grey, info } = await sharp(data).greyscale().raw().toBuffer({ resolveWithObject: true });
  const px = info.width * info.height;
  const out = Buffer.alloc(px * 4);
  const WHITE = 232;
  for (let i = 0; i < px; i++) {
    const l = grey[i * info.channels];
    out[i * 4 + 3] = l >= WHITE ? 0 : Math.min(255, Math.round(((WHITE - l) / WHITE) * 255 * 1.15));
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

type OpenEventStream = <T>(res: express.Response) => { send: (e: StreamEvent<T>) => void; signal: AbortSignal; end: () => void };

/** /api/projects */
export function createProjectsRouter(service: ProjectService, openEventStream: OpenEventStream): express.Router {
  const router = express.Router();
  const fail = (res: express.Response, err: unknown) => {
    const { status, message } = toHttpError(err);
    if (status >= 500) console.error('Projects error:', err);
    res.status(status >= 400 && status < 600 && status !== 401 ? status : 500).json({ error: message });
  };
  const handle = (fn: (req: express.Request, res: express.Response) => Promise<unknown>) => (req: express.Request, res: express.Response) => {
    fn(req, res).then((data) => res.json(data), (err) => fail(res, err));
  };
  const load = async (req: express.Request, res: express.Response) => {
    const p = await service.find(req.params.id, currentUser(res));
    if (!p) throw new ResearchError('Project not found.', 404);
    return p;
  };
  const kindOf = (v: unknown): OutputKind => {
    if (typeof v === 'string' && (OUTPUT_KINDS as string[]).includes(v)) return v as OutputKind;
    throw new ResearchError('Unknown picture type.', 400);
  };
  const noStore = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" };

  router.get('/', handle(async (req, res) => service.summaries(currentUser(res), req.query.all === '1' && isAdmin(res))));
  router.post('/', handle(async (req, res) => {
    const p = await service.create(currentUser(res), req.body ?? {});
    return p;
  }));
  router.get('/:id', handle(async (req, res) => forUser(await load(req, res), currentUser(res))));
  router.patch('/:id', handle(async (req, res) => forUser(await service.patch(req.params.id, currentUser(res), req.body ?? {}), currentUser(res))));
  router.delete('/:id', handle(async (req, res) => {
    await service.remove(req.params.id, currentUser(res));
    return { ok: true };
  }));

  router.post('/:id/estimate', handle(async (req, res) => {
    const user = currentUser(res);
    return (await service.plan(await load(req, res), user, kindOf(req.body?.kind))).estimate;
  }));

  router.post('/:id/generate', async (req, res) => {
    let kind: OutputKind;
    try {
      kind = kindOf(req.body?.kind);
    } catch (err) {
      return fail(res, err);
    }
    const confirmed = req.body?.confirmedUsd === undefined || req.body?.confirmedUsd === null ? null : Number(req.body.confirmedUsd);
    const stream = openEventStream<GenerationResult>(res);
    try {
      const result = await service.generate(req.params.id, currentUser(res), kind, Number.isFinite(confirmed) ? confirmed : null, stream.send, stream.signal);
      stream.send({ type: 'result', data: result });
    } catch (err) {
      const { message } = toHttpError(err);
      if (!stream.signal.aborted) console.error('Generation failed:', err);
      stream.send({ type: 'error', message });
    } finally {
      stream.end();
    }
  });

  router.get('/:id/images/:imageId', async (req, res) => {
    try {
      const p = await load(req, res);
      const file = service.imageFile(p, req.params.imageId);
      if (!file) return res.status(404).end();
      const img = p.images.find((i) => i.id === req.params.imageId)!;
      const name = `${p.title.replace(/[^A-Za-z0-9 _-]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'design'}-${img.kind}.png`;
      res.set({ ...noStore, 'Content-Type': 'image/png', ...(req.query.download === '1' ? { 'Content-Disposition': `attachment; filename="${name}"` } : {}) });
      res.sendFile(file);
    } catch {
      res.status(404).end();
    }
  });

  router.put('/:id/photo', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '8mb' }), handle(async (req, res) => {
    if (req.query.consent !== '1') throw new ResearchError('Please confirm the consent first.', 400);
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new ResearchError('No photo.', 400);
    return forUser(await service.savePhoto(req.params.id, currentUser(res), req.body), currentUser(res));
  }));
  router.delete('/:id/photo', handle(async (req, res) => forUser(await service.deletePhoto(req.params.id, currentUser(res)), currentUser(res))));
  router.get('/:id/photo', async (req, res) => {
    try {
      const p = await load(req, res);
      const file = service.photoFile(p);
      if (!file) return res.status(404).end();
      res.set({ ...noStore, 'Content-Type': 'image/jpeg' });
      res.sendFile(file);
    } catch {
      res.status(404).end();
    }
  });

  return router;
}

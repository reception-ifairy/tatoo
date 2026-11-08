import fs from 'fs';
import path from 'path';
import express from 'express';
import sharp from 'sharp';
import { STARTER_SET_ID, missingSamples, type OptionGroup, type OptionItem, type OptionSet, type OptionsState, type SampleEstimate, type SampleRun } from '../src/options';
import { imagePrice, type ImageModelDef } from '../src/imageModels';
import type { StreamEvent } from '../src/types';
import type { ProviderService } from './providers';
import { generateImage } from './images/generate';
import { samplePrompt } from './prompts';
import { ResearchError, toHttpError } from './errors';
import { requireAdmin } from './auth';
import { tattooSet } from './tattooSet';

// The option window's data: the tattoo set (server/tattooSet.ts) with thumbnails read from disk. The super admin
// can have missing thumbnails made with the sample image model — a PAID step that is always estimated first and
// only runs when the client sends back the exact cost the admin confirmed. Palettes and diagrams are drawn.

const SAMPLE_PX = 256;
const SLUG = /^[a-z0-9_]{1,40}$/;
const MAX_TARGETS = 400;

export class OptionService {
  private dir: string;
  private running = false;

  constructor(private providers: ProviderService, appDir: string) {
    this.dir = path.join(appDir, 'data', 'options');
  }

  private file(group: string, code: string): string {
    return path.join(this.dir, STARTER_SET_ID, group, `${code}.webp`);
  }

  private existingSample(group: string, code: string): string | null {
    const file = this.file(group, code);
    if (!fs.existsSync(file)) return null;
    return `/api/options/samples/${STARTER_SET_ID}/${group}/${code}.webp?v=${Math.round(fs.statSync(file).mtimeMs).toString(36)}`;
  }

  /** The tattoo set with every thumbnail that exists on disk. */
  set(): OptionSet {
    const base = tattooSet();
    return {
      ...base,
      groups: base.groups.map((g) => (g.kind !== 'sample' ? g : { ...g, options: g.options.map((o) => ({ ...o, sample: this.existingSample(g.id, o.code) })) })),
    };
  }

  state(): OptionsState {
    return { activeId: STARTER_SET_ID, sets: [this.set()] };
  }

  /** Thumbnails that would be made (missing ones, or exactly `only`) and what they cost with the sample model. */
  async estimate(only?: { group: string; code: string }[]): Promise<{ estimate: SampleEstimate; jobs: { group: OptionGroup; option: OptionItem }[]; model: ImageModelDef | null; apiKey: string | null }> {
    const set = this.set();
    const jobs = only?.length
      ? set.groups.filter((g) => g.kind === 'sample').flatMap((group) => group.options.filter((o) => only.some((x) => x.group === group.id && x.code === o.code)).map((option) => ({ group, option })))
      : missingSamples(set);
    const prefs = await this.providers.getPrefs();
    const resolved = await this.providers.resolveImageModel(prefs.image.sampleModel);
    const model = 'error' in resolved ? null : resolved.model;
    const priceEach = model ? imagePrice(model, model.sizing.kind === 'tier' ? model.sizing.tiers[0] : undefined) : 0;
    let blocker = 'error' in resolved ? resolved.error : null;
    if (!jobs.length) blocker = 'Every thumbnail is ready.';
    return {
      estimate: { setId: STARTER_SET_ID, count: jobs.length, priceEach, totalUsd: Math.round(priceEach * jobs.length * 10000) / 10000, model: model ? { id: model.id, label: model.label } : null, blocker },
      jobs,
      model,
      apiKey: 'error' in resolved ? null : resolved.apiKey,
    };
  }

  /** Makes the thumbnails one by one. `confirmedUsd` must equal the estimate the admin accepted. */
  async makeSamples(confirmedUsd: number, only: { group: string; code: string }[] | undefined, onEvent: (e: StreamEvent<SampleRun>) => void, signal: AbortSignal): Promise<SampleRun> {
    if (this.running) throw new ResearchError('Thumbnails are already being made.', 409);
    const { estimate, jobs, model, apiKey } = await this.estimate(only);
    if (estimate.blocker) throw new ResearchError(estimate.blocker, 400);
    if (!model || !apiKey) throw new ResearchError('No sample model.', 400);
    if (!(Math.abs(estimate.totalUsd - confirmedUsd) < 0.00005)) {
      throw new ResearchError('The cost changed since you confirmed it (another model or other options). Check the cost again.', 409);
    }
    const set = this.set();
    const tier = model.sizing.kind === 'tier' ? model.sizing.tiers[0] : undefined;
    this.running = true;
    let made = 0;
    let failed = 0;
    let spentUsd = 0;
    try {
      onEvent({ type: 'status', message: `Making ${jobs.length} thumbnails with ${model.label}…` });
      for (const [i, { group, option }] of jobs.entries()) {
        if (signal.aborted) break;
        let url: string | null = null;
        let error: string | null = null;
        try {
          const image = await generateImage({ model, apiKey, prompt: samplePrompt(group.motif ?? set.motif, group.promptLabel, option.prompt), aspect: '1:1', tier, signal });
          spentUsd += image.costUsd;
          const webp = await sharp(image.data).resize(SAMPLE_PX, SAMPLE_PX, { fit: 'cover' }).webp({ quality: 82 }).toBuffer();
          const file = this.file(group.id, option.code);
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, webp);
          url = this.existingSample(group.id, option.code);
          made++;
        } catch (err) {
          if (signal.aborted) break;
          failed++;
          const { status, message } = toHttpError(err, model.provider);
          error = message;
          console.error(`Sample ${group.id}/${option.code} failed:`, err);
          // A key or billing problem fails every remaining picture the same way — stop instead of retrying.
          if ([400, 401, 402, 403, 404, 429].includes(status)) {
            onEvent({ type: 'sample', group: group.id, code: option.code, url, error, done: i + 1, total: jobs.length, spentUsd: Math.round(spentUsd * 10000) / 10000 });
            break;
          }
        }
        onEvent({ type: 'sample', group: group.id, code: option.code, url, error, done: i + 1, total: jobs.length, spentUsd: Math.round(spentUsd * 10000) / 10000 });
      }
    } finally {
      this.running = false;
    }
    return { set: this.set(), made, failed, spentUsd: Math.round(spentUsd * 10000) / 10000 };
  }

  sampleFile(setId: string, group: string, file: string): string | null {
    const m = /^([a-z0-9_]{1,40})\.webp$/.exec(file);
    if (!m || setId !== STARTER_SET_ID || !SLUG.test(group)) return null;
    const full = this.file(group, m[1]);
    return fs.existsSync(full) ? full : null;
  }
}

function parseOnly(raw: unknown): { group: string; code: string }[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items = raw.flatMap((x) => (x && typeof x.group === 'string' && typeof x.code === 'string' && SLUG.test(x.group) && SLUG.test(x.code) ? [{ group: x.group, code: x.code }] : []));
  return items.length ? items.slice(0, MAX_TARGETS) : undefined;
}

/** /api/options — the tattoo option set for everyone; paid thumbnail generation (SSE) for the admin. */
export function createOptionsRouter(service: OptionService, openEventStream: <T>(res: express.Response) => { send: (e: StreamEvent<T>) => void; signal: AbortSignal; end: () => void }): express.Router {
  const router = express.Router();

  router.get('/', (_req, res) => res.json(service.state()));

  router.post('/sets/:id/estimate', requireAdmin, (req, res) => {
    service.estimate(parseOnly(req.body?.only)).then(
      (r) => res.json(r.estimate),
      (err) => {
        const { status, message } = toHttpError(err);
        res.status(status === 401 ? 500 : status).json({ error: message });
      },
    );
  });

  router.post('/sets/:id/samples', requireAdmin, async (req, res) => {
    const confirmedUsd = Number(req.body?.confirmedUsd);
    if (!Number.isFinite(confirmedUsd) || confirmedUsd < 0) return res.status(400).json({ error: 'Check and confirm the cost first.' });
    const stream = openEventStream<SampleRun>(res);
    try {
      const run = await service.makeSamples(confirmedUsd, parseOnly(req.body?.only), stream.send, stream.signal);
      stream.send({ type: 'result', data: run });
    } catch (err) {
      stream.send({ type: 'error', message: toHttpError(err).message });
    } finally {
      stream.end();
    }
  });

  router.get('/samples/:set/:group/:file', (req, res) => {
    const file = service.sampleFile(req.params.set, req.params.group, req.params.file);
    if (!file) return res.status(404).end();
    res.set({ 'Content-Type': 'image/webp', 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
    res.sendFile(file);
  });

  return router;
}

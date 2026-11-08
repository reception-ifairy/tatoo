import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { APP } from './src/config';
import { createStore } from './server/store';
import { ProviderService } from './server/providers';
import { createSettingsRouter, createVoiceRouter } from './server/settingsRoutes';
import { createChatRouter } from './server/chat';
import { OptionService, createOptionsRouter } from './server/options';
import { createAuthRouter, requireAdmin, requireUser, currentUser } from './server/auth';
import { UserService } from './server/users';
import { ProjectService, createProjectsRouter } from './server/projects';
import { createAdminRouter } from './server/adminRoutes';
import { initCompendium, compendium, articleBySlug } from './server/compendium';
import { initPersona } from './server/persona';
import type { StreamEvent } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

initCompendium(__dirname);
initPersona(__dirname);
const store = createStore(__dirname);
const providers = new ProviderService(store);
const users = new UserService(store);
const options = new OptionService(providers, __dirname);
const projects = new ProjectService(store, providers, users, __dirname);

/** Opens a server-sent-events response and returns helpers to emit events and detect disconnects. */
function openEventStream<T>(res: express.Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });
  const ping = setInterval(() => !res.writableEnded && res.write(': ping\n\n'), 15_000);
  const send = (event: StreamEvent<T>) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  return {
    send,
    signal: controller.signal,
    end: () => {
      clearInterval(ping);
      res.end();
    },
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  // Local-only by default; set HOST=0.0.0.0 to expose the app on the network (e.g. in a container).
  const HOST = process.env.HOST || '127.0.0.1';
  const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production');

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '64kb' }));

  // Login for the admin and the clients — every other /api route requires a session.
  app.use('/api/auth', createAuthRouter(users));
  app.use('/api', requireUser(users));

  // The admin's language (the only account with Polish).
  app.put('/api/me/lang', requireAdmin, async (req, res) => {
    await users.setAdminLang(req.body?.lang === 'pl' ? 'pl' : 'en');
    res.json({ user: await users.publicAdmin() });
  });
  app.get('/api/me', (_req, res) => res.json({ user: currentUser(res) }));

  // Read-only content: compendium and library.
  app.get('/api/compendium', (_req, res) => res.set('Cache-Control', 'private, max-age=600').json(compendium()));
  app.get('/api/library/:slug', (req, res) => {
    const found = articleBySlug(req.params.slug);
    if (!found) return res.status(404).json({ error: 'Article not found.' });
    res.set('Cache-Control', 'private, max-age=600').json(found);
  });

  app.use('/api/settings', requireAdmin, createSettingsRouter(providers));
  // Voice (Gemini TTS and voice messages) is the admin's for now; clients type.
  app.use('/api/voice', requireAdmin, createVoiceRouter(providers));
  app.use('/api/chat', createChatRouter(store, providers, users, __dirname));
  app.use('/api/options', createOptionsRouter(options, openEventStream));
  app.use('/api/projects', createProjectsRouter(projects, openEventStream));
  app.use('/api/admin', requireAdmin, createAdminRouter(users, projects, store));

  // Body-parser errors (too large, bad JSON) as JSON instead of Express's HTML page.
  app.use('/api', (err: { status?: number; type?: string }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 500;
    const message = err.type === 'entity.too.large' ? 'The file is too large.' : status === 500 ? 'Server error.' : 'Invalid request.';
    if (status === 500) console.error(err);
    res.status(status).json({ error: message });
  });

  try {
    await store.init();
  } catch (err) {
    console.error(`Could not connect to the settings database (${store.kind}):`, err instanceof Error ? err.message : err);
  }

  if (!isProduction) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    if (!fs.existsSync(path.join(__dirname, 'dist', 'index.html'))) {
      console.error('The app is not built (no dist folder). Run first: npm run build');
      process.exit(1);
    }
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`${APP.name} running at http://localhost:${PORT} · storage: ${store.kind}${isProduction ? '' : ' · dev'}`);
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is in use — close the other copy of the app or set another PORT in .env.`);
    } else {
      console.error('Could not start the server:', err.message);
    }
    process.exit(1);
  });
}

startServer();

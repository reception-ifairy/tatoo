import express from 'express';
import type { UserService } from './users';
import type { ProjectService } from './projects';
import type { SettingsStore } from './store';
import { toHttpError } from './errors';

/** /api/admin — clients and packages (super admin only; the router is mounted behind requireAdmin). */
export function createAdminRouter(users: UserService, projects: ProjectService, store: SettingsStore): express.Router {
  const router = express.Router();
  const handle = (fn: (req: express.Request) => Promise<unknown>) => (req: express.Request, res: express.Response) => {
    fn(req).then(
      (data) => res.json(data),
      (err) => {
        const { status, message } = toHttpError(err);
        if (status >= 500) console.error('Admin error:', err);
        res.status(status === 401 ? 500 : status).json({ error: message });
      },
    );
  };

  router.get('/clients', handle(() => users.listClients()));
  router.post('/clients', handle((req) => users.createClient(req.body ?? {})));
  router.patch('/clients/:id', handle((req) => users.updateClient(req.params.id, req.body ?? {})));
  router.delete('/clients/:id', handle(async (req) => {
    if (!(await users.getClient(req.params.id))) return { ok: true };
    // The client's designs, pictures, scar photos and consultations go with the account.
    await projects.removeOwner(req.params.id);
    for (const c of await store.listConversations(req.params.id, 10000)) await store.deleteConversation(c.id);
    await users.deleteClient(req.params.id);
    return { ok: true };
  }));

  router.get('/packages', handle(() => users.packages()));
  router.put('/packages', handle((req) => users.savePackages(req.body?.packages)));

  return router;
}

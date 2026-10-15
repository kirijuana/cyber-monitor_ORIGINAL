/**
 * REST API. Все ответы — из единого домена (adapters/base/types.ts),
 * поэтому фронтовые виджеты не знают, откуда пришли данные.
 */
import type { FastifyInstance } from 'fastify';
import type { AdapterRegistry } from '../adapters/base/registry.js';
import type { DrWebAdapter } from '../adapters/drweb/DrWebAdapter.js';
import { requireAdmin, signJwt, type Role } from '../plugins/auth.js';

export interface RoutesDeps {
  registry: AdapterRegistry;
  authSecret: string;
  users: Array<{ username: string; password: string; role: Role }>;
  tokenTtlSec: number;
}

export async function registerRoutes(app: FastifyInstance, deps: RoutesDeps): Promise<void> {
  /* ---------------------------------- auth ---------------------------------- */
  app.post('/api/auth/login', async (req, reply) => {
    const body = req.body as { username?: string; password?: string };
    const user = deps.users.find((u) => u.username === body?.username && u.password === body?.password);
    if (!user) return reply.code(401).send({ error: 'invalid_credentials' });
    const now = Math.floor(Date.now() / 1000);
    const token = signJwt({ sub: user.username, role: user.role, iat: now, exp: now + deps.tokenTtlSec }, deps.authSecret);
    return { token, role: user.role, username: user.username };
  });

  /* -------------------------------- dashboard ------------------------------- */
  app.get('/api/dashboard', async () => deps.registry.gather());

  app.get('/api/sources', async () =>
    Promise.all(deps.registry.list().map((a) => a.getStatus())),
  );

  /* --------------------------------- drweb ---------------------------------- */
  const drweb = (): DrWebAdapter | undefined =>
    deps.registry.get('drweb') as DrWebAdapter | undefined;

  app.get('/api/drweb/snapshot', async (_req, reply) => {
    const a = drweb();
    if (!a) return reply.code(503).send({ error: 'source_unavailable' });
    return a.getSnapshot();
  });

  app.get('/api/drweb/stations', async (_req, reply) => {
    const a = drweb();
    if (!a) return reply.code(503).send({ error: 'source_unavailable' });
    return a.getStations();
  });

  app.post<{ Params: { uid: string }; Body: { action: 'restart' | 'scan' | 'recover' } }>(
    '/api/drweb/stations/:uid/actions',
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const a = drweb();
      if (!a) return reply.code(503).send({ error: 'source_unavailable' });
      const res = await a.stationAction(req.params.uid, req.body.action);
      return reply.code(res.ok ? 200 : 502).send(res);
    },
  );

  app.post<{ Params: { id: string }; Body: { action: 'delete' | 'restore' } }>(
    '/api/drweb/quarantine/:id/actions',
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const a = drweb();
      if (!a) return reply.code(503).send({ error: 'source_unavailable' });
      const res = await a.quarantineAction(req.params.id, req.body.action);
      return reply.code(res.ok ? 200 : 502).send(res);
    },
  );
}

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { AdapterRegistry } from './adapters/base/registry.js';
import { registerAuth } from './plugins/auth.js';
import { registerRoutes } from './routes/api.js';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV === 'production' ? undefined : undefined,
  },
});

await app.register(cors, { origin: true });

const registry = new AdapterRegistry(config.registry, app.log);

registerAuth(app, config.auth.secret);
await registerRoutes(app, {
  registry,
  authSecret: config.auth.secret,
  users: config.auth.users,
  tokenTtlSec: config.auth.tokenTtlSec,
});

// Мониторинг мониторинга: собственный health-endпоинт без авторизации
app.get('/healthz', async () => ({
  ok: true,
  uptimeSec: Math.round(process.uptime()),
  adapters: registry.list().map((a) => a.name),
  memoryMb: Math.round(process.memoryUsage().rss / 1e6),
}));

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`Backend ready on http://${config.host}:${config.port} (drweb mode: ${config.registry.drwebMode})`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

/**
 * Минимальный JWT (HS256) на node:crypto без внешних зависимостей.
 * Достаточно для MVP: подпись, срок жизни, роли. Прод-замена — fastify-jwt/OIDC.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export type Role = 'admin' | 'viewer';

export interface JwtPayload {
  sub: string;
  role: Role;
  iat: number;
  exp: number;
}

const b64url = (buf: Buffer): string => buf.toString('base64url');

export function signJwt(payload: JwtPayload, secret: string): string {
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest();
  return `${header}.${body}.${b64url(sig)}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as JwtPayload;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export function registerAuth(app: FastifyInstance, secret: string): void {
  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.url === '/healthz' || req.url.startsWith('/api/auth/login')) return;
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    const payload = token ? verifyJwt(token, secret) : null;
    if (!payload) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Требуется Bearer-токен' });
    }
    req.user = payload;
  });
}

export function requireAdmin(req: FastifyRequest, reply: FastifyReply): boolean {
  if (req.user?.role !== 'admin') {
    void reply.code(403).send({ error: 'forbidden', message: 'Действие доступно роли admin' });
    return false;
  }
  return true;
}

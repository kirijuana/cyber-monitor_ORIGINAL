import { describe, expect, it } from 'vitest';
import { signJwt, verifyJwt } from '../src/plugins/auth.js';

const SECRET = 'test-secret';

describe('jwt', () => {
  it('round-trip подпись/проверка', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signJwt({ sub: 'admin', role: 'admin', iat: now, exp: now + 60 }, SECRET);
    const payload = verifyJwt(token, SECRET);
    expect(payload?.sub).toBe('admin');
    expect(payload?.role).toBe('admin');
  });

  it('отклоняет токен с другой подписью', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signJwt({ sub: 'x', role: 'admin', iat: now, exp: now + 60 }, 'other');
    expect(verifyJwt(token, SECRET)).toBeNull();
  });

  it('отклоняет просроченный токен', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signJwt({ sub: 'x', role: 'viewer', iat: now - 120, exp: now - 60 }, SECRET);
    expect(verifyJwt(token, SECRET)).toBeNull();
  });

  it('отклоняет мусор', () => {
    expect(verifyJwt('not.a.jwt', SECRET)).toBeNull();
    expect(verifyJwt('', SECRET)).toBeNull();
  });
});

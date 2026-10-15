/**
 * HTTP-клиент: единая точка выхода во внешний мир.
 * - инжектит Bearer-токен из auth-store;
 * - на 401 очищает сессию (роутер редиректит на /login);
 * - типизированные endpoints — страницы не пишут url-строки руками.
 */
import type { DashboardPayload, DrWebSnapshot, DrWebStation } from '../../entities/types';

const TOKEN_KEY = 'infra-monitor-token';

export const tokenStore = {
  get(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
  },
};

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  const token = tokenStore.get();
  if (token) headers.set('authorization', `Bearer ${token}`);

  const res = await fetch(`/api/${path}`, { ...init, headers });
  if (res.status === 401) {
    tokenStore.clear();
    throw new ApiError(401, 'Сессия истекла, войдите заново');
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      msg = body.message ?? body.error ?? msg;
    } catch {
      /* тело не JSON */
    }
    throw new ApiError(res.status, msg);
  }
  return (await res.json()) as T;
}

export const api = {
  login(username: string, password: string): Promise<{ token: string; role: string; username: string }> {
    return request('auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  },
  dashboard(): Promise<DashboardPayload> {
    return request('dashboard');
  },
  drwebSnapshot(): Promise<DrWebSnapshot> {
    return request('drweb/snapshot');
  },
  drwebStations(): Promise<DrWebStation[]> {
    return request('drweb/stations');
  },
  stationAction(uid: string, action: 'restart' | 'scan' | 'recover'): Promise<{ ok: boolean; message: string }> {
    return request(`drweb/stations/${uid}/actions`, { method: 'POST', body: JSON.stringify({ action }) });
  },
  quarantineAction(id: string, action: 'delete' | 'restore'): Promise<{ ok: boolean; message: string }> {
    return request(`drweb/quarantine/${id}/actions`, { method: 'POST', body: JSON.stringify({ action }) });
  },
};

import { create } from 'zustand';
import { api, tokenStore } from '../../shared/api/client';

interface AuthState {
  username: string | null;
  role: 'admin' | 'viewer' | null;
  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
}

/** Роль влияет на UI: viewer не видит кнопки действий (backend всё равно дублирует проверку). */
export const useAuth = create<AuthState>((set) => ({
  username: null,
  role: null,
  login: async (username, password) => {
    const res = await api.login(username, password);
    tokenStore.set(res.token);
    set({ username: res.username, role: res.role as 'admin' | 'viewer' });
  },
  logout: () => {
    tokenStore.clear();
    set({ username: null, role: null });
  },
}));

export const useIsAdmin = (): boolean => useAuth((s) => s.role === 'admin');

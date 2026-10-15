import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Outlet, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import { Moon, Sun, ShieldCheck, LogOut, LayoutDashboard } from 'lucide-react';
import { api } from '../shared/api/client';
import { APP_CONFIG } from '../shared/config/constants';
import { Button } from '../shared/ui/Button';
import { Toaster, useNow } from '../shared/ui/Toaster';
import { useAuth, useIsAdmin } from '../features/auth/authStore';
import { DashboardPage } from '../pages/Dashboard/DashboardPage';
import { DrWebPage } from '../pages/DrWeb/DrWebPage';
import { LoginPage } from './LoginPage';

/** Общие query keys — единая схема для всех страниц. */
export const queryKeys = {
  dashboard: ['dashboard'] as const,
  drwebSnapshot: ['drweb', 'snapshot'] as const,
  drwebStations: ['drweb', 'stations'] as const,
};

export function useDashboardQuery() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: api.dashboard,
    refetchInterval: APP_CONFIG.refreshIntervalMs,
    staleTime: APP_CONFIG.refreshIntervalMs - 5_000,
  });
}

export function useDrWebSnapshotQuery() {
  return useQuery({
    queryKey: queryKeys.drwebSnapshot,
    queryFn: api.drwebSnapshot,
    refetchInterval: APP_CONFIG.refreshIntervalMs,
    staleTime: APP_CONFIG.refreshIntervalMs - 5_000,
  });
}

export function useDrWebStationsQuery() {
  return useQuery({
    queryKey: queryKeys.drwebStations,
    queryFn: api.drwebStations,
    refetchInterval: APP_CONFIG.refreshIntervalMs * 2,
    staleTime: APP_CONFIG.refreshIntervalMs,
  });
}

/* --------------------------------- layout ---------------------------------- */

function ThemeToggle() {
  const [dark, setDark] = useState(() => !document.documentElement.classList.contains('light'));
  return (
    <Button
      variant="subtle"
      size="sm"
      aria-label="Переключить тему"
      onClick={() => {
        const root = document.documentElement;
        if (dark) {
          root.classList.remove('dark');
          root.classList.add('light');
        } else {
          root.classList.remove('light');
          root.classList.add('dark');
        }
        setDark(!dark);
      }}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

function Shell() {
  const username = useAuth((s) => s.username);
  const logout = useAuth((s) => s.logout);
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const now = useNow(30_000);
  void now; // тик для будущих live-подписей в шапке

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 lg:px-6">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-5 text-accent" />
            <span className="hidden sm:inline">InfraWatch</span>
          </button>
          <nav className="flex items-center gap-1 text-sm">
            <Button variant="subtle" size="sm" onClick={() => navigate('/')}>
              <LayoutDashboard className="size-4" /> Дашборд
            </Button>
            <Button variant="subtle" size="sm" onClick={() => navigate('/drweb')}>
              Dr.Web
            </Button>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-muted md:inline">
              {username} · {isAdmin ? 'admin' : 'viewer'}
            </span>
            <ThemeToggle />
            <Button
              variant="subtle"
              size="sm"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuth((s) => s.username);
  const hasToken = Boolean(localStorage.getItem('infra-monitor-token'));
  if (!token && !hasToken) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/* ---------------------------------- app ------------------------------------ */

export function App() {
  const qc = useQueryClient();
  const role = useAuth((s) => s.role);
  const username = useAuth((s) => s.username);

  // восстановление сессии из токена: если JWT есть — считаем пользователя авторизованным
  // (роль подтянется при первом же запросе; для UI достаточно флага admin из токена-заглушки)
  if (username === null && localStorage.getItem('infra-monitor-token')) {
    try {
      const payload = JSON.parse(atob(localStorage.getItem('infra-monitor-token')!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      useAuth.setState({ username: payload.sub ?? 'user', role: payload.role === 'admin' ? 'admin' : 'viewer' });
    } catch {
      /* повреждённый токен — редирект на login сделает RequireAuth */
    }
  }
  void role;
  void qc;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="drweb" element={<DrWebPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

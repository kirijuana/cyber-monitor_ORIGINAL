import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Button } from '../shared/ui/Button';
import { useAuth } from '../features/auth/authStore';
import { toast } from '../shared/ui/Toaster';

/** Экран входа. Демо-учётки подсказаны прямо на форме — это внутренний инструмент. */
export function LoginPage() {
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось войти');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4 p-6">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="size-6 text-accent" />
          Мониторинг инфраструктуры
        </div>
        <p className="text-xs text-muted">Войдите, чтобы продолжить. Роли: admin (полный доступ), viewer (только чтение).</p>
        <label className="block space-y-1">
          <span className="caption">Логин</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-line bg-bg px-3 text-sm"
            autoComplete="username"
          />
        </label>
        <label className="block space-y-1">
          <span className="caption">Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-line bg-bg px-3 text-sm"
            autoComplete="current-password"
          />
        </label>
        <Button variant="primary" className="w-full justify-center" disabled={busy}>
          {busy ? 'Входим…' : 'Войти'}
        </Button>
        <p className="text-center text-[11px] text-muted">demo: admin/admin · viewer/viewer</p>
      </form>
    </div>
  );
}

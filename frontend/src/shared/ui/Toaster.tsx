import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { cn } from '../lib/format';

/* ---------------------------------- toasts ---------------------------------- */

export type ToastKind = 'success' | 'warning' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Императивный API для вызова из обработчиков (не из рендера). */
export const toast = {
  success: (m: string) => useToastStore.getState().push('success', m),
  warning: (m: string) => useToastStore.getState().push('warning', m),
  error: (m: string) => useToastStore.getState().push('error', m),
  info: (m: string) => useToastStore.getState().push('info', m),
};

const ICONS: Record<ToastKind, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
};
const TONES: Record<ToastKind, string> = {
  success: 'border-ok/40 text-ok',
  warning: 'border-warn/40 text-warn',
  error: 'border-crit/40 text-crit',
  info: 'border-accent/40 text-accent',
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div key={t.id} className={cn('card flex items-start gap-2.5 border p-3 shadow-lg shadow-black/20', TONES[t.kind])}>
            <Icon className="mt-0.5 size-4 shrink-0" />
            <p className="flex-1 text-sm text-ink leading-snug">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="text-muted hover:text-ink" aria-label="Закрыть">
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ tick (для timeAgo) --------------------------- */

/** Перерисовка раз в секунду — чтобы «N мин назад» был живым без сокетов. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

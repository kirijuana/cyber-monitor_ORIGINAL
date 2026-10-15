import { cn } from '../lib/format';

export type LiveState = 'idle' | 'syncing' | 'stale' | 'error';

const DOT: Record<LiveState, string> = {
  idle: 'bg-ok',
  syncing: 'bg-accent',
  stale: 'bg-warn',
  error: 'bg-crit',
};

/**
 * Live-индикатор: пульсирующая точка + текстовый статус.
 * green=idle, blue=syncing, yellow=stale, red=error — «честный» виджет.
 */
export function LiveIndicator({ state, label, className }: { state: LiveState; label: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted', className)}>
      <span className="relative flex size-2.5">
        <span className={cn('absolute inline-flex size-full rounded-full opacity-60 animate-pulseDot', DOT[state])} />
        <span className={cn('relative inline-flex size-2.5 rounded-full', DOT[state])} />
      </span>
      <span className="tabular-nums">{label}</span>
    </div>
  );
}

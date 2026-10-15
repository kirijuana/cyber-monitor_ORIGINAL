import { cn } from '../lib/format';

/** Прогресс-бар с семантическими порогами (auto → цвет по percent). */
export function ProgressBar({
  value,
  max = 100,
  tone = 'auto',
  label,
  right,
  className,
}: {
  value: number;
  max?: number;
  tone?: 'auto' | 'ok' | 'warn' | 'crit' | 'accent';
  label?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const resolved =
    tone === 'auto' ? (percent > 90 ? 'crit' : percent > 75 ? 'warn' : 'ok') : tone;
  const barColor = { ok: 'bg-ok', warn: 'bg-warn', crit: 'bg-crit', accent: 'bg-accent' }[resolved];

  return (
    <div className={cn('space-y-1.5', className)}>
      {(label || right) && (
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted">{label}</span>
          <span className="tabular-nums text-ink/80">{right}</span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-elevated" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

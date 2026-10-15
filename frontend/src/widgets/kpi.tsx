/**
 * Widgets-слой: композитные блоки, собираемые из features/entities/shared.
 * Виджет не знает о роутинге и не ходит в API сам — данные приходят через props.
 */

/* -------------------------------- KpiCard ---------------------------------- */
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { Severity } from '../../entities/types';
import { Sparkline } from '../../shared/ui/Sparkline';
import { cn } from '../../shared/lib/format';

export function KpiCard({
  label,
  value,
  sub,
  trend,
  spark,
  severity = 'ok',
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  /** positiveIsBad: рост угроз — это плохо (стрелка станет красной) */
  trend?: { delta: number; positiveIsBad?: boolean };
  spark?: number[];
  severity?: Severity;
}) {
  const up = (trend?.delta ?? 0) > 0;
  const good = trend ? !(up === trend.positiveIsBad) : true;
  const trendColor = !trend ? '' : good ? 'text-ok' : 'text-crit';
  const valueColor = severity === 'critical' ? 'text-crit' : severity === 'warning' ? 'text-warn' : 'text-ink';

  return (
    <div className="card p-4 flex flex-col gap-1">
      <p className="caption">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <p className={cn('text-3xl font-semibold tabular-nums leading-none', valueColor)}>{value}</p>
        {trend && trend.delta !== 0 && (
          <span className={cn('flex items-center gap-0.5 text-xs font-medium tabular-nums', trendColor)}>
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(trend.delta)}
          </span>
        )}
      </div>
      {sub && <p className="text-xs text-muted">{sub}</p>}
      {spark && spark.length > 1 && (
        <div className="mt-1 -mb-1">
          <Sparkline data={spark} color={severity === 'ok' ? 'rgb(var(--c-accent))' : severity === 'warning' ? 'rgb(var(--c-warn))' : 'rgb(var(--c-crit))'} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------ SectionHeader ------------------------------- */
export function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{title}</h2>
      {right}
    </div>
  );
}

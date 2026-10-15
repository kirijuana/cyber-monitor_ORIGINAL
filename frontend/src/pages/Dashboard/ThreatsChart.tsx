/**
 * График угроз за период. Источник данных — snapshot Dr.Web (threats по дням).
 * Период 24ч = последняя точка, разбитая на «часы» условно: backend отдаёт
 * суточную агрегацию, поэтому для 24ч рисуем один день + вчерашний для сравнения.
 */
import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Period } from '../../entities/types';
import { useDrWebSnapshotQuery } from '../../app/App';
import { periodDays } from '../../shared/lib/format';
import { Skeleton } from '../../shared/ui/Skeleton';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ShieldAlert } from 'lucide-react';

export function ThreatsChart({ period }: { period: Period }) {
  const query = useDrWebSnapshotQuery();
  const threats = query.data?.threats;

  const rows = useMemo(() => {
    if (!threats) return [];
    const days = periodDays(period);
    return threats.slice(-days).map((t) => ({
      day: t.date.slice(5), // mm-dd
      Обнаружено: t.detected,
      Полечено: t.cured,
      Удалено: t.deleted,
      Карантин: t.quarantined,
    }));
  }, [threats, period]);

  if (query.isLoading) return <Skeleton className="h-[260px] w-full" />;
  if (query.isError || !threats) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Источник недоступен"
        hint="Не удалось получить статистику угроз. Данные могут быть устаревшими — см. индикатор сверху."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <defs>
          {[
            ['Обнаружено', '--c-crit'],
            ['Полечено', '--c-ok'],
            ['Карантин', '--c-warn'],
          ].map(([name, token]) => (
            <linearGradient key={name} id={`g-${name}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`rgb(var(${token}))`} stopOpacity={0.3} />
              <stop offset="100%" stopColor={`rgb(var(${token}))`} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-line))" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'rgb(var(--c-muted))' }} tickLine={false} axisLine={{ stroke: 'rgb(var(--c-line))' }} minTickGap={24} />
        <YAxis tick={{ fontSize: 11, fill: 'rgb(var(--c-muted))' }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            background: 'rgb(var(--c-elevated))',
            border: '1px solid rgb(var(--c-line))',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: 'rgb(var(--c-ink))' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="Обнаружено" stroke="rgb(var(--c-crit))" fill="url(#g-Обнаружено)" strokeWidth={2} />
        <Area type="monotone" dataKey="Полечено" stroke="rgb(var(--c-ok))" fill="url(#g-Полечено)" strokeWidth={1.5} />
        <Area type="monotone" dataKey="Карантин" stroke="rgb(var(--c-warn))" fill="url(#g-Карантин)" strokeWidth={1.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

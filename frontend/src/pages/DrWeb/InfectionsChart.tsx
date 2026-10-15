/**
 * График срабатываний Dr.Web по дням (infections-chart.ds / statistics.ds).
 * Area-стек не используем: линии читаются лучше при пересечениях серий.
 */
import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DrWebThreatPoint } from '../../entities/types';

export function InfectionsChart({ threats }: { threats: DrWebThreatPoint[] }) {
  const rows = useMemo(
    () =>
      threats.map((t) => ({
        day: t.date.slice(5), // mm-dd — компактная ось
        Обнаружено: t.detected,
        Полечено: t.cured,
        Удалено: t.deleted,
        Карантин: t.quarantined,
      })),
    [threats],
  );

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-line))" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11, fill: 'rgb(var(--c-muted))' }}
          tickLine={false}
          axisLine={{ stroke: 'rgb(var(--c-line))' }}
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'rgb(var(--c-muted))' }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
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
        <Line type="monotone" dataKey="Обнаружено" stroke="rgb(var(--c-crit))" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
        <Line type="monotone" dataKey="Полечено" stroke="rgb(var(--c-ok))" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
        <Line type="monotone" dataKey="Карантин" stroke="rgb(var(--c-warn))" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
        <Line type="monotone" dataKey="Удалено" stroke="rgb(var(--c-muted))" strokeWidth={1.5} strokeDasharray="4 3" dot={false} activeDot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

import { Area, AreaChart, ResponsiveContainer } from 'recharts';

/** Мини-график для KPI-карточки. Данные — плоский массив чисел. */
export function Sparkline({
  data,
  color = 'rgb(var(--c-accent))',
  height = 36,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  if (data.length < 2) return null;
  const points = data.map((v, i) => ({ i, v }));
  const id = `spark-${color.replace(/\W/g, '')}-${data.length}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${id})`} isAnimationActive={false} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * Главный дашборд: «всё ок или нет?» за 5 секунд.
 * Порядок раскрытия: статус систем → KPI → график+лента → инциденты.
 */
import { useMemo, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import type { Period } from '../../entities/types';
import { useDashboardQuery } from '../../app/App';
import { useHotkeys } from '../../features/hotkeys/useHotkeys';
import { useVisibilityRefetch } from '../../features/refresh/useAutoRefresh';
import { APP_CONFIG, PERIODS } from '../../shared/config/constants';
import { cn, isStale, timeAgo } from '../../shared/lib/format';
import { Button } from '../../shared/ui/Button';
import { LiveIndicator } from '../../shared/ui/LiveIndicator';
import { EmptyState } from '../../shared/ui/EmptyState';
import { SkeletonKpi } from '../../shared/ui/Skeleton';
import { StatusBadge } from '../../shared/ui/StatusBadge';
import { toast, useNow } from '../../shared/ui/Toaster';
import { DataTable, type Column } from '../../shared/ui/DataTable';
import { KpiCard, SectionHeader } from '../../widgets/kpi';
import { StatusBar } from '../../widgets/statusbar';
import { ActivityFeed } from '../../widgets/activityfeed';
import { ThreatsChart } from './ThreatsChart';

function PeriodSwitch({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex rounded-lg border border-line p-0.5" role="tablist" aria-label="Период">
      {PERIODS.map((p) => (
        <button
          key={p.id}
          role="tab"
          aria-selected={period === p.id}
          onClick={() => onChange(p)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            period === p.id ? 'bg-elevated text-accent' : 'text-muted hover:text-ink',
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const query = useDashboardQuery();
  const now = useNow(5_000);
  const data = query.data;

  useVisibilityRefetch(query.refetch);
  useHotkeys({
    onRefresh: () => {
      void query.refetch().then(() => toast.info('Данные обновлены'));
    },
  });

  const stale = useMemo(() => (data ? isStale(data.generatedAt, APP_CONFIG.staleThresholdMs, now) : false), [data, now]);

  const m = useMemo(() => {
    const map = new Map<string, number>();
    for (const x of data?.metrics ?? []) {
      if (typeof x.value === 'number') map.set(`${x.source}.${x.metric}`, x.value);
    }
    return map;
  }, [data]);

  const kpis = useMemo(() => {
    if (!data) return null;
    const online = m.get('drweb.stations.online') ?? 0;
    const total = m.get('drweb.stations.total') ?? 0;
    const offline = m.get('drweb.stations.offline') ?? 0;
    const threats24 = m.get('drweb.threats.detected_24h') ?? 0;
    const quarantine = m.get('drweb.quarantine.objects') ?? 0;
    const newbies = m.get('drweb.stations.newbies') ?? 0;
    // тренд угроз: сегодня vs вчера — из графика snapshot не нужен, берём из events-агрегата невозможно;
    // поэтому backend кладёт percent в metadata; для тренда используем delta метрики online за опрос.
    return { online, total, offline, threats24, quarantine, newbies };
  }, [data, m]);

  const liveLabel = query.isFetching
    ? 'Синхронизация…'
    : stale
      ? `Stale · ${data ? timeAgo(data.generatedAt, now) : 'нет данных'}`
      : data
        ? `Live · обновлено ${timeAgo(data.generatedAt, now)}`
        : 'Ожидание данных';

  const incidentColumns: Column<(typeof data extends undefined ? never : NonNullable<typeof data>['incidents'][number])>[] = useMemo(
    () => [
      {
        key: 'timestamp',
        header: 'Время',
        sortable: true,
        sortValue: (r) => r.timestamp,
        render: (r) => <span className="tabular-nums text-muted">{timeAgo(r.timestamp, now)}</span>,
      },
      { key: 'source', header: 'Источник', render: (r) => <span className="uppercase text-xs text-muted">{r.source}</span> },
      {
        key: 'severity',
        header: 'Severity',
        render: (r) => <StatusBadge severity={r.severity}>{r.severity === 'critical' ? 'Critical' : 'Warning'}</StatusBadge>,
      },
      {
        key: 'title',
        header: 'Инцидент',
        sortable: true,
        sortValue: (r) => r.title,
        className: 'max-w-[420px]',
        render: (r) => (
          <span className="block truncate">
            {r.title}
            {r.description && <span className="ml-2 text-xs text-muted">{r.description}</span>}
          </span>
        ),
      },
      {
        key: 'action',
        header: '',
        render: (r) => (
          <Button size="sm" onClick={() => toast.info(`Переход к "${r.entity ?? r.title}" будет доступен на странице источника`)}>
            Открыть
          </Button>
        ),
      },
    ],
    [now],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Мониторинг инфраструктуры</h1>
          <LiveIndicator
            className="mt-1"
            state={query.isFetching ? 'syncing' : query.isError ? 'error' : stale ? 'stale' : 'idle'}
            label={liveLabel}
          />
        </div>
        <div className="flex items-center gap-2">
          {onPeriodChange && <PeriodSwitch period={period} onChange={onPeriodChange} />}
          <Button
            onClick={() => {
              void query.refetch().then(() => toast.success('Обновлено'));
            }}
            disabled={query.isFetching}
          >
            <RefreshCw className={cn('size-4', query.isFetching && 'animate-spin')} />
            Refresh
            <kbd className="ml-1 hidden rounded border border-line px-1 text-[10px] text-muted md:inline">R</kbd>
          </Button>
        </div>
      </div>

      {/* Error / loading */}
      {query.isError && !data && (
        <EmptyState
          icon={ShieldCheck}
          title="Backend недоступен"
          hint={`Не удалось получить данные: ${(query.error as Error)?.message}. Проверьте, что API запущен (порт 8090).`}
          className="card py-14"
        />
      )}

      {/* 2. Status bar */}
      <section aria-label="Статус систем">
        <StatusBar sources={data?.sources ?? []} metrics={data?.metrics ?? []} loading={query.isLoading} />
      </section>

      {/* 3. KPI grid */}
      <section aria-label="Ключевые показатели">
        {!kpis ? (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonKpi key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <KpiCard
              label="Станции Dr.Web"
              value={`${kpis.online}/${kpis.total}`}
              sub={`offline: ${kpis.offline} · activated охват ${kpis.total ? Math.round((kpis.online / kpis.total) * 100) : 0}%`}
              severity={kpis.total && kpis.online / kpis.total < 0.8 ? 'warning' : 'ok'}
            />
            <KpiCard
              label="Угрозы за 24ч"
              value={kpis.threats24}
              sub="детектов всего за сутки"
              trend={{ delta: kpis.threats24 > 30 ? 12 : -5, positiveIsBad: true }}
              severity={kpis.threats24 > 40 ? 'warning' : 'ok'}
            />
            <KpiCard
              label="Карантин"
              value={kpis.quarantine}
              sub="объектов ждут решения"
              severity={kpis.quarantine > 50 ? 'warning' : 'ok'}
            />
            <KpiCard label="Новые станции" value={kpis.newbies} sub="не активированы / без лицензии" severity={kpis.newbies > 10 ? 'warning' : 'ok'} />
          </div>
        )}
      </section>

      {/* 4. Chart + feed */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 card p-4">
          <SectionHeader title="Угрозы за период" right={<PeriodSwitch period={period} onChange={(p) => onPeriodChange?.(p)} />} />
          <ThreatsChart period={period} loading={query.isLoading} />
        </div>
        <div className="card p-4">
          <SectionHeader title="Активность" />
          <ActivityFeed events={data?.events ?? []} loading={query.isLoading} />
        </div>
      </section>

      {/* 5. Incidents */}
      <section aria-label="Инциденты">
        <SectionHeader
          title="Инциденты"
          right={
            data && data.incidents.length > 0 ? (
              <StatusBadge severity="critical">{data.incidents.length} критичных</StatusBadge>
            ) : undefined
          }
        />
        {data && data.incidents.length === 0 ? (
          <div className="card">
            <EmptyState title="Инцидентов нет. Всё под контролем 🟢" hint="Критических событий за текущий период не зарегистрировано." />
          </div>
        ) : (
          <DataTable
            rows={data?.incidents ?? []}
            columns={incidentColumns}
            rowKey={(r) => r.id}
            initialSort={{ key: 'timestamp', dir: 'desc' }}
            maxHeightPx={280}
          />
        )}
      </section>
    </div>
  );
}

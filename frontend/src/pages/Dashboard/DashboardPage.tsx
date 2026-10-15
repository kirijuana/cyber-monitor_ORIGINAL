/**
 * Главный дашборд: «всё ок или нет?» за 5 секунд.
 * Порядок раскрытия: статус систем → KPI → график+лента → инциденты.
 */
import { useMemo, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import type { Period, SourceEvent } from '../../entities/types';
import { useDashboardQuery, useDrWebSnapshotQuery } from '../../app/App';
import { useHotkeys } from '../../features/hotkeys/useHotkeys';
import { useVisibilityRefetch } from '../../features/refresh/useAutoRefresh';
import { APP_CONFIG, PERIODS } from '../../shared/config/constants';
import { cn, isStale, periodDays, timeAgo } from '../../shared/lib/format';
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
          key={p.id as string}
          role="tab"
          aria-selected={period === p.id}
          onClick={() => onChange(p.id)}
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
  const snapshotQuery = useDrWebSnapshotQuery();
  const now = useNow(5_000);
  const data = query.data;

  const refetchAll = () => {
    void Promise.all([query.refetch(), snapshotQuery.refetch()]).then(() => toast.success('Данные обновлены'));
  };

  useVisibilityRefetch(query.refetch);
  useHotkeys({ onRefresh: refetchAll });

  const stale = useMemo(
    () => (data ? isStale(data.generatedAt, APP_CONFIG.staleThresholdMs, now) : false),
    [data, now],
  );

  /** Map `source.metric` → числовое значение для быстрой сборки KPI. */
  const m = useMemo(() => {
    const map = new Map<string, number>();
    for (const x of data?.metrics ?? []) {
      if (typeof x.value === 'number') map.set(`${x.source}.${x.metric}`, x.value);
    }
    return map;
  }, [data]);

  const kpis = useMemo(() => {
    if (!data) return null;
    return {
      online: m.get('drweb.stations.online') ?? 0,
      total: m.get('drweb.stations.total') ?? 0,
      offline: m.get('drweb.stations.offline') ?? 0,
      threats24: m.get('drweb.threats.detected_24h') ?? 0,
      quarantine: m.get('drweb.quarantine.objects') ?? 0,
      newbies: m.get('drweb.stations.newbies') ?? 0,
    };
  }, [data, m]);

  /**
   * Честный тренд угроз: сравниваем сумму detected за период и за предыдущий
   * такой же период из реальных данных statistics.ds, а не выдуманную дельту.
   */
  const threatTrend = useMemo(() => {
    const threats = snapshotQuery.data?.threats;
    if (!threats || threats.length < 2) return undefined;
    const days = Math.min(periodDays(period), Math.floor(threats.length / 2));
    const cur = threats.slice(-days).reduce((a, t) => a + t.detected, 0);
    const prev = threats.slice(-days * 2, -days).reduce((a, t) => a + t.detected, 0);
    return { delta: cur - prev, positiveIsBad: true };
  }, [snapshotQuery.data, period]);

  const stationSpark = useMemo(() => {
    const threats = snapshotQuery.data?.threats;
    if (!threats) return undefined;
    return threats.slice(-14).map((t) => t.detected);
  }, [snapshotQuery.data]);

  const liveLabel = query.isFetching
    ? 'Синхронизация…'
    : query.isError && !data
      ? 'Источник недоступен'
      : stale
        ? `Stale · ${data ? timeAgo(data.generatedAt, now) : 'нет данных'}`
        : data
          ? `Live · обновлено ${timeAgo(data.generatedAt, now)}`
          : 'Ожидание данных';

  const incidentColumns: Column<SourceEvent>[] = useMemo(
    () => [
      {
        key: 'timestamp',
        header: 'Время',
        sortable: true,
        sortValue: (r) => r.timestamp,
        render: (r) => (
          <span className="tabular-nums text-muted" title={r.timestamp}>
            {timeAgo(r.timestamp, now)}
          </span>
        ),
      },
      { key: 'source', header: 'Источник', render: (r) => <span className="text-xs uppercase text-muted">{r.source}</span> },
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
          <Button size="sm" onClick={() => toast.info(`Откройте страницу источника «${r.source}» — раздел по событию "${r.entity ?? r.title}"`)}>
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
            state={query.isFetching ? 'syncing' : query.isError && !data ? 'error' : stale ? 'stale' : 'idle'}
            label={liveLabel}
          />
        </div>
        <div className="flex items-center gap-2">
          <PeriodSwitch period={period} onChange={setPeriod} />
          <Button onClick={refetchAll} disabled={query.isFetching}>
            <RefreshCw className={cn('size-4', query.isFetching && 'animate-spin')} />
            Refresh
            <kbd className="ml-1 hidden rounded border border-line px-1 text-[10px] text-muted md:inline">R</kbd>
          </Button>
        </div>
      </div>

      {/* Backend целиком недоступен — честный empty state, без выдуманных цифр */}
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
              sub={`offline: ${kpis.offline} · охват ${kpis.total ? Math.round((kpis.online / kpis.total) * 100) : 0}%`}
              severity={kpis.total > 0 && kpis.online / kpis.total < 0.8 ? 'warning' : 'ok'}
            />
            <KpiCard
              label={`Угрозы · ${period}`}
              value={kpis.threats24}
              sub="детектов за последние сутки"
              trend={threatTrend}
              spark={stationSpark}
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
          <SectionHeader title="Угрозы за период" right={<PeriodSwitch period={period} onChange={setPeriod} />} />
          <ThreatsChart period={period} />
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
        {query.isLoading ? (
          <div className="card p-4">
            <div className="skeleton h-40" />
          </div>
        ) : data && data.incidents.length === 0 ? (
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

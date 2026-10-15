/**
 * Страница Dr.Web — рабочее место админа антивируса.
 * Данные загружаются здесь (TanStack Query + авто-обновление), табы презентационные.
 * Шорткаты: R — refresh, 1..5 — переключение табов, Esc — blur поиска.
 */
import { useMemo, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useDrWebSnapshotQuery, useDrWebStationsQuery } from '../../app/App';
import { useIsAdmin } from '../../features/auth/authStore';
import { useHotkeys } from '../../features/hotkeys/useHotkeys';
import { useVisibilityRefetch } from '../../features/refresh/useAutoRefresh';
import { APP_CONFIG } from '../../shared/config/constants';
import { cn, isStale, timeAgo } from '../../shared/lib/format';
import { Button } from '../../shared/ui/Button';
import { LiveIndicator } from '../../shared/ui/LiveIndicator';
import { EmptyState } from '../../shared/ui/EmptyState';
import { SkeletonCard } from '../../shared/ui/Skeleton';
import { toast, useNow } from '../../shared/ui/Toaster';
import { OverviewTab, QuarantineTab, RepositoryTab, StationsTab, ThreatsTab } from './tabs';

const TABS = [
  { id: 'overview', label: 'Обзор' },
  { id: 'stations', label: 'Станции' },
  { id: 'threats', label: 'Угрозы и события' },
  { id: 'quarantine', label: 'Карантин' },
  { id: 'repository', label: 'Репозиторий' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function DrWebPage() {
  const [tab, setTab] = useState<TabId>('overview');
  const snapshotQuery = useDrWebSnapshotQuery();
  const stationsQuery = useDrWebStationsQuery();
  const isAdmin = useIsAdmin();
  const now = useNow(10_000);

  const refetchAll = () => {
    void Promise.all([snapshotQuery.refetch(), stationsQuery.refetch()]).then(() =>
      toast.success('Данные Dr.Web обновлены'),
    );
  };

  useVisibilityRefetch(snapshotQuery.refetch);
  useHotkeys({
    onRefresh: refetchAll,
    onEscape: () => {
      const el = document.activeElement;
      if (el instanceof HTMLElement) el.blur();
    },
  });

  const snapshot = snapshotQuery.data;
  const fetching = snapshotQuery.isFetching || stationsQuery.isFetching;
  const stale = useMemo(
    () => (snapshot ? isStale(snapshot.server.serverTime, APP_CONFIG.staleThresholdMs, now) : false),
    [snapshot, now],
  );

  const liveLabel = fetching
    ? 'Синхронизация…'
    : snapshotQuery.isError
      ? 'Источник недоступен'
      : stale
        ? `Stale · ${snapshot ? timeAgo(snapshot.server.serverTime, now) : 'нет данных'}`
        : snapshot
          ? `Live · обновлено ${timeAgo(snapshot.server.serverTime, now)}`
          : 'Ожидание данных';

  const quarantineCount = snapshot?.quarantine.length ?? 0;

  return (
    <div className="space-y-4">
      {/* Header страницы */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dr.Web Enterprise Security Suite</h1>
          <LiveIndicator
            className="mt-1"
            state={fetching ? 'syncing' : snapshotQuery.isError ? 'error' : stale ? 'stale' : 'idle'}
            label={liveLabel}
          />
        </div>
        <Button onClick={refetchAll} disabled={fetching}>
          <RefreshCw className={cn('size-4', fetching && 'animate-spin')} />
          Refresh
          <kbd className="ml-1 hidden rounded border border-line px-1 text-[10px] text-muted md:inline">R</kbd>
        </Button>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Разделы Dr.Web" className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            title={`Шорткат: ${i + 1}`}
            className={cn(
              '-mb-px rounded-t-lg border-b-2 px-3.5 py-2 text-sm font-medium transition-colors',
              tab === t.id
                ? 'border-accent text-ink'
                : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {t.label}
            {t.id === 'quarantine' && quarantineCount > 0 && (
              <span className="ml-1.5 rounded-full bg-warn/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-warn">
                {quarantineCount}
              </span>
            )}
            {t.id === 'stations' && stationsQuery.data && (
              <span className="ml-1.5 text-xs tabular-nums text-muted">{stationsQuery.data.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Контент таба */}
      {snapshotQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonCard lines={6} />
          <SkeletonCard lines={6} />
          <SkeletonCard lines={6} />
        </div>
      ) : snapshotQuery.isError || !snapshot ? (
        <EmptyState
          icon={ShieldCheck}
          title="Source unavailable"
          hint={`Dr.Web не отвечает: ${(snapshotQuery.error as Error)?.message ?? 'ошибка сети'}. Показывать устаревшие цифры не будем — нажмите Refresh, когда сервер оживёт.`}
          className="card py-14"
        />
      ) : (
        <div className="min-h-[420px]">
          {tab === 'overview' && <OverviewTab snapshot={snapshot} />}
          {tab === 'stations' &&
            (stationsQuery.isLoading ? (
              <SkeletonCard lines={10} />
            ) : (
              <StationsTab
                stations={stationsQuery.data ?? []}
                canMutate={isAdmin}
                onAction={(msg) => toast.success(msg)}
              />
            ))}
          {tab === 'threats' && <ThreatsTab snapshot={snapshot} />}
          {tab === 'quarantine' && (
            <QuarantineTab objects={snapshot.quarantine} canMutate={isAdmin} onAction={(msg) => toast.success(msg)} />
          )}
          {tab === 'repository' && <RepositoryTab repository={snapshot.repository} />}
        </div>
      )}

      {!isAdmin && (
        <p className="text-xs text-muted">
          Роль viewer: действия над станциями и карантином отключены. Войдите под admin для управления.
        </p>
      )}
    </div>
  );
}

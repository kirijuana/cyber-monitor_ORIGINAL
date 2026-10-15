/** Status bar: карточка одной системы на дашборде. Клик → страница системы. */
import { useNavigate } from 'react-router-dom';
import { Activity, Globe2, Mail, ShieldCheck } from 'lucide-react';
import type { Metric, SourceId, SourceStatus } from '../../entities/types';
import { HealthBadge } from '../../shared/ui/StatusBadge';
import { SOURCES } from '../../shared/config/constants';
import { timeAgo } from '../../shared/lib/format';
import { Skeleton } from '../../shared/ui/Skeleton';

const ICONS: Record<SourceId, React.ComponentType<{ className?: string }>> = {
  drweb: ShieldCheck,
  bitrix24: Globe2,
  mail: Mail,
  zabbix: Activity,
};

/** Краткая метрика для карточки источника — первая доступная «говорящая». */
function headlineMetric(metrics: Metric[], source: SourceId): string | null {
  const byName: Partial<Record<SourceId, string[]>> = {
    drweb: ['stations.online', 'threats.detected_24h'],
  };
  for (const name of byName[source] ?? []) {
    const m = metrics.find((x) => x.source === source && x.metric === name);
    if (m) return typeof m.value === 'number' ? `${m.value}` : String(m.value);
  }
  const any = metrics.find((x) => x.source === source);
  return any ? String(any.value) : null;
}

export function StatusBar({ sources, metrics, loading }: { sources: SourceStatus[]; metrics: Metric[]; loading: boolean }) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SOURCES.map((s) => (
          <Skeleton key={s.id} className="h-[88px] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {SOURCES.map((meta) => {
        const status = sources.find((s) => s.source === meta.id);
        const Icon = ICONS[meta.id];
        const metric = status ? headlineMetric(metrics, meta.id) : null;
        const clickable = Boolean(meta.route);
        return (
          <button
            key={meta.id}
            onClick={() => meta.route && navigate(meta.route)}
            disabled={!clickable}
            title={status?.message}
            className={`card flex items-start gap-3 p-4 text-left transition-colors ${
              clickable ? 'hover:border-accent/40 hover:bg-elevated cursor-pointer' : 'opacity-70 cursor-default'
            }`}
          >
            <span className="mt-0.5 rounded-lg bg-elevated p-2 text-accent">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{meta.title}</span>
                {status && <HealthBadge health={status.health} />}
              </span>
              <span className="mt-1 block truncate text-xs text-muted">
                {metric ? `${metric} · ` : ''}
                {status ? timeAgo(status.lastCheckedAt) : 'нет статуса'}
                {!clickable && ' · скоро'}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

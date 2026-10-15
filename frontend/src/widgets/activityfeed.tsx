/** Activity feed: лента событий с иконкой, severity и честным таймстампом. */
import { AlertTriangle, KeyRound, ShieldAlert, Smartphone, DatabaseBackup, Server } from 'lucide-react';
import type { EventCategory, SourceEvent } from '../../entities/types';
import { cn, timeAgo } from '../../shared/lib/format';
import { EmptyState } from '../../shared/ui/EmptyState';
import { SkeletonCard } from '../../shared/ui/Skeleton';

const CATEGORY_ICON: Record<EventCategory, React.ComponentType<{ className?: string }>> = {
  threat: ShieldAlert,
  station: Smartphone,
  license: KeyRound,
  repository: DatabaseBackup,
  server: Server,
  system: AlertTriangle,
};

export function ActivityFeed({ events, loading }: { events: SourceEvent[]; loading: boolean }) {
  if (loading) return <SkeletonCard lines={6} />;
  if (events.length === 0) {
    return <EmptyState title="Событий нет" hint="Источники ещё не успели ничего сообщить — загляните позже." />;
  }
  return (
    <ul className="divide-y divide-line">
      {events.slice(0, 10).map((e) => {
        const Icon = CATEGORY_ICON[e.category];
        return (
          <li key={e.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
            <span
              className={cn(
                'mt-0.5 rounded-md p-1.5',
                e.severity === 'critical' ? 'bg-crit/10 text-crit' : e.severity === 'warning' ? 'bg-warn/10 text-warn' : 'bg-elevated text-muted',
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm leading-tight">{e.title}</p>
              {e.description && <p className="mt-0.5 truncate text-xs text-muted">{e.description}</p>}
            </div>
            <time className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted" title={e.timestamp}>
              {timeAgo(e.timestamp)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}

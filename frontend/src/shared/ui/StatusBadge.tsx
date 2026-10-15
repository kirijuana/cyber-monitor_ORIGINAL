import type { Severity, SourceHealth } from '../../entities/types';
import { cn } from '../lib/format';

const SEVERITY_STYLES: Record<Severity, string> = {
  ok: 'bg-ok/10 text-ok border-ok/30',
  warning: 'bg-warn/10 text-warn border-warn/30',
  critical: 'bg-crit/10 text-crit border-crit/30',
};

export function StatusBadge({ severity, children, className }: { severity: Severity; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        SEVERITY_STYLES[severity],
        className,
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          severity === 'ok' ? 'bg-ok' : severity === 'warning' ? 'bg-warn' : 'bg-crit',
        )}
      />
      {children}
    </span>
  );
}

const HEALTH_LABELS: Record<SourceHealth, { text: string; sev: Severity }> = {
  online: { text: 'Online', sev: 'ok' },
  degraded: { text: 'Degraded', sev: 'warning' },
  offline: { text: 'Offline', sev: 'critical' },
  unconfigured: { text: 'Не настроен', sev: 'warning' },
};

export function HealthBadge({ health }: { health: SourceHealth }) {
  const h = HEALTH_LABELS[health];
  return <StatusBadge severity={h.sev}>{h.text}</StatusBadge>;
}

import { Inbox } from 'lucide-react';
import { cn } from '../lib/format';

/** Осмысленное пустое состояние: причина + что делать, а не голое «нет данных». */
export function EmptyState({
  title,
  hint,
  icon: Icon = Inbox,
  className,
}: {
  title: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-10 text-center', className)}>
      <Icon className="size-8 text-muted/60" />
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="text-xs text-muted max-w-sm">{hint}</p>}
    </div>
  );
}

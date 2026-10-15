import { cn } from '../lib/format';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card p-4 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3', i % 2 ? 'w-5/6' : 'w-full')} />
      ))}
    </div>
  );
}

export function SkeletonKpi() {
  return (
    <div className="card p-4">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

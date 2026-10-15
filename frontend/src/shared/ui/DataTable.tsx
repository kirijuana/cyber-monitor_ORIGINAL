/**
 * Data table с виртуальным скроллингом (окно строк), sticky header, сортировкой
 * и мультивыбором. Виртуализация — собственная (slice по scrollTop): без внешних
 * зависимостей, работает для >1000 строк; при <=200 строках рендерит всё сразу.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/format';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => number | string;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** selectable + onSelect → включаются чекбоксы и bulk-панель родителя */
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (ids: Set<string>) => void;
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
  maxHeightPx?: number;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
}

const ROW_HEIGHT = 40;
const OVERSCAN = 8;
const VIRTUALIZE_THRESHOLD = 200;

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  selectable,
  selected,
  onSelectedChange,
  onRowClick,
  emptyState,
  maxHeightPx = 420,
  initialSort,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'ru');
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sort, columns]);

  const virtualize = sorted.length > VIRTUALIZE_THRESHOLD;
  const { visible, padTop, padBottom } = useMemo(() => {
    if (!virtualize) return { visible: sorted, padTop: 0, padBottom: 0 };
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const count = Math.ceil(maxHeightPx / ROW_HEIGHT) + OVERSCAN * 2;
    const end = Math.min(sorted.length, start + count);
    return { visible: sorted.slice(start, end), padTop: start * ROW_HEIGHT, padBottom: (sorted.length - end) * ROW_HEIGHT };
  }, [sorted, scrollTop, virtualize, maxHeightPx]);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const toggleSort = (key: string) => {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  const allIds = useMemo(() => new Set(sorted.map(rowKey)), [sorted, rowKey]);
  const allSelected = selectable && selected && allIds.size > 0 && [...allIds].every((id) => selected.has(id));
  const toggleAll = () => {
    if (!onSelectedChange || !selected) return;
    onSelectedChange(allSelected ? new Set() : new Set(allIds));
  };

  if (rows.length === 0 && emptyState) return <>{emptyState}</>;

  return (
    <div ref={scrollerRef} onScroll={onScroll} className="overflow-auto rounded-lg border border-line" style={{ maxHeight: maxHeightPx }}>
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-elevated/95 backdrop-blur">
          <tr className="text-left text-xs uppercase tracking-wide text-muted">
            {selectable && (
              <th className="w-8 px-3 py-2">
                <input type="checkbox" checked={Boolean(allSelected)} onChange={toggleAll} aria-label="Выбрать все" className="accent-[rgb(var(--c-accent))]" />
              </th>
            )}
            {columns.map((c) => (
              <th key={c.key} className={cn('whitespace-nowrap px-3 py-2 font-medium', c.className)}>
                {c.sortable ? (
                  <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-ink">
                    {c.header}
                    {sort?.key === c.key ? (
                      sort.dir === 'asc' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
                    ) : (
                      <ArrowUpDown className="size-3 opacity-40" />
                    )}
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {padTop > 0 && <tr style={{ height: padTop }} aria-hidden />}
          {visible.map((row) => {
            const id = rowKey(row);
            const isSelected = selected?.has(id);
            return (
              <tr
                key={id}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'border-t border-line/60 transition-colors',
                  isSelected ? 'bg-accent/10' : 'hover:bg-elevated/70',
                  onRowClick && 'cursor-pointer',
                )}
                style={{ height: ROW_HEIGHT }}
              >
                {selectable && (
                  <td className="px-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={Boolean(isSelected)}
                      onChange={() => {
                        if (!onSelectedChange || !selected) return;
                        const next = new Set(selected);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        onSelectedChange(next);
                      }}
                      aria-label={`Выбрать ${id}`}
                      className="accent-[rgb(var(--c-accent))]"
                    />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={cn('whitespace-nowrap px-3 py-1.5', c.className)}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
          {padBottom > 0 && <tr style={{ height: padBottom }} aria-hidden />}
        </tbody>
      </table>
    </div>
  );
}

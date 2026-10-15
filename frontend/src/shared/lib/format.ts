import type { Period, Severity } from '../../entities/types';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** «7 min ago» / «только что» — честная относительная давность. */
export function timeAgo(iso: string | null, now: number = Date.now()): string {
  if (!iso) return 'никогда';
  const diff = Math.max(0, now - new Date(iso).getTime());
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return 'только что';
  if (sec < 60) return `${sec} сек назад`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}

/** Порог честности: данные старше 2 интервалов опроса считаем stale. */
export function isStale(iso: string | null, thresholdMs = 90_000, now: number = Date.now()): boolean {
  if (!iso) return true;
  return now - new Date(iso).getTime() > thresholdMs;
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  if (d > 0) return `${d} д ${h} ч`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h} ч ${m} мин`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  const units = ['КБ', 'МБ', 'ГБ', 'ТБ'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function severityColor(s: Severity): string {
  return s === 'critical' ? 'text-crit' : s === 'warning' ? 'text-warn' : 'text-ok';
}

export function periodDays(p: Period): number {
  return p === '24h' ? 1 : p === '7d' ? 7 : 30;
}

export function pct(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

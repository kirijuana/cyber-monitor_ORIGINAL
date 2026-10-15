/**
 * Слой конфигурации: константы, которые может захотеть поменять админ/деплойер.
 * Значения можно переопределить через vite env (VITE_*).
 */
import type { Period, SourceId } from '../../entities/types';

const env = import.meta.env as Record<string, string | undefined>;

export const APP_CONFIG = {
  /** Интервал авто-обновления дашборда, мс (polling; WebSocket — итерация 3) */
  refreshIntervalMs: Number(env.VITE_REFRESH_INTERVAL_MS ?? 45_000),
  /** Порог «честности»: данные старше этого возраста показываются как Stale */
  staleThresholdMs: Number(env.VITE_STALE_THRESHOLD_MS ?? 90_000),
};

export const PERIODS: Array<{ id: Period; label: string }> = [
  { id: '24h', label: '24ч' },
  { id: '7d', label: '7д' },
  { id: '30d', label: '30д' },
];

export interface SourceMeta {
  id: SourceId;
  title: string;
  short: string;
  route?: string; // undefined → страница источника ещё не существует
}

/** Реестр источников на стороне UI: новый источник = одна строка здесь + опциональный роут. */
export const SOURCES: SourceMeta[] = [
  { id: 'drweb', title: 'Dr.Web ESS', short: 'Антивирус', route: '/drweb' },
  { id: 'bitrix24', title: 'Bitrix24', short: 'Портал' },
  { id: 'mail', title: 'Почтовый сервер', short: 'Mail' },
  { id: 'zabbix', title: 'Zabbix', short: 'NOC' },
];

import type { Metric, SourceEvent, SourceId, SourceStatus } from './types.js';

/**
 * Контракт источника. Всё, что нужно ядру для работы с любой системой:
 *getStatus / fetchMetrics / fetchEvents.
 *
 * Правила для реализаций:
 *  1. Методы НЕ бросают исключения наружу — при недоступности источника
 *     возвращают пустые массивы / health:'offline' (честность данных).
 *  2. Реализация сама решает, где данные реальные, а где мок (env-переключатель).
 *  3. Никакого состояния в ядре: кэш и планирование — задача layer'а registry.
 */
export interface SourceAdapter {
  readonly name: SourceId;
  readonly title: string;

  getStatus(): Promise<SourceStatus>;
  fetchMetrics(): Promise<Metric[]>;
  fetchEvents(limit?: number): Promise<SourceEvent[]>;
}

/** Хелпер для адаптеров: собрать Metric без повторов boilerplate. */
export function makeMetric(
  source: SourceId,
  metric: string,
  value: number | string,
  severity: Metric['severity'] = 'ok',
  metadata?: Record<string, unknown>,
  timestamp: string = new Date().toISOString(),
): Metric {
  return { timestamp, source, metric, value, severity, metadata };
}

export function makeEvent(
  partial: Omit<SourceEvent, 'id'> & { id?: string },
): SourceEvent {
  return {
    id: partial.id ?? `${partial.source}:${partial.category}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    ...partial,
  };
}

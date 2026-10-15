/**
 * Заглушка Zabbix (итерация 2).
 * План: JSON-RPC 2.0 (user.login → problem.get / item.get), карта триггеров.
 */
import type { SourceAdapter } from '../base/Adapter.js';
import type { Metric, SourceEvent, SourceStatus } from '../base/types.js';

export class ZabbixAdapter implements SourceAdapter {
  readonly name = 'zabbix' as const;
  readonly title = 'Zabbix';

  constructor(private readonly apiUrl?: string, private readonly token?: string) {}

  async getStatus(): Promise<SourceStatus> {
    return {
      source: this.name,
      health: this.apiUrl ? 'degraded' : 'unconfigured',
      lastCheckedAt: new Date().toISOString(),
      message: this.apiUrl
        ? 'Получение метрик ещё не реализовано (итерация 2)'
        : 'Источник не настроен: задайте ZABBIX_API_URL и ZABBIX_API_TOKEN',
    };
  }

  async fetchMetrics(): Promise<Metric[]> {
    return [];
  }

  async fetchEvents(): Promise<SourceEvent[]> {
    return [];
  }
}

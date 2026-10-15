/**
 * Заглушка Bitrix24 (итерация 2). Демонстрирует, как выглядит новый источник:
 * реализовал SourceAdapter — зарегистрировал в registry — получил место на
 * дашборде. Ядро менять не нужно.
 */
import type { SourceAdapter } from '../base/Adapter.js';
import type { Metric, SourceEvent, SourceStatus } from '../base/types.js';

export class Bitrix24Adapter implements SourceAdapter {
  readonly name = 'bitrix24' as const;
  readonly title = 'Bitrix24 (портал)';

  constructor(private readonly webhookUrl?: string) {}

  private get configured(): boolean {
    return Boolean(this.webhookUrl);
  }

  async getStatus(): Promise<SourceStatus> {
    return {
      source: this.name,
      health: this.configured ? 'degraded' : 'unconfigured',
      lastCheckedAt: new Date().toISOString(),
      message: this.configured
        ? 'Получение метрик ещё не реализовано (итерация 2)'
        : 'Источник не настроен: задайте BITRIX24_WEBHOOK_URL',
    };
  }

  async fetchMetrics(): Promise<Metric[]> {
    // TODO(итерация 2): вызов REST /rest/im.online.json, /rest/crm.deal.list и т.д.
    return [];
  }

  async fetchEvents(): Promise<SourceEvent[]> {
    return [];
  }
}

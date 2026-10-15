/**
 * Заглушка почтового сервера (итерация 2).
 * План: IMAP/SMTP-пробы, очередь postfix/exim, DKIM/SPF/DMARC-статусы.
 */
import type { SourceAdapter } from '../base/Adapter.js';
import type { Metric, SourceEvent, SourceStatus } from '../base/types.js';

export class MailAdapter implements SourceAdapter {
  readonly name = 'mail' as const;
  readonly title = 'Почтовый сервер';

  constructor(private readonly host?: string) {}

  async getStatus(): Promise<SourceStatus> {
    return {
      source: this.name,
      health: this.host ? 'degraded' : 'unconfigured',
      lastCheckedAt: new Date().toISOString(),
      message: this.host
        ? 'Получение метрик ещё не реализовано (итерация 2)'
        : 'Источник не настроен: задайте MAIL_HOST',
    };
  }

  async fetchMetrics(): Promise<Metric[]> {
    return [];
  }

  async fetchEvents(): Promise<SourceEvent[]> {
    return [];
  }
}

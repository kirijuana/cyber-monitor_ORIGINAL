/**
 * Registry — единственная точка, где ядро знает о существовании источников.
 * Подключение нового источника = одна строка register() здесь + новый класс-адаптер.
 */
import type { FastifyBaseLogger } from 'fastify';
import type { SourceAdapter } from './Adapter.js';
import { DrWebAdapter } from '../drweb/DrWebAdapter.js';
import { Bitrix24Adapter } from '../bitrix24/Bitrix24Adapter.js';
import { MailAdapter } from '../mail/MailAdapter.js';
import { ZabbixAdapter } from '../zabbix/ZabbixAdapter.js';
import type { DashboardPayload, SourceEvent, SourceStatus } from './types.js';

export interface RegistryConfig {
  drwebMode: 'mock' | 'live' | 'auto';
  drwebBaseUrl: string;
  drwebUsername: string;
  drwebPassword: string;
  bitrix24WebhookUrl?: string;
  mailHost?: string;
  zabbixApiUrl?: string;
  zabbixApiToken?: string;
}

export class AdapterRegistry {
  private adapters: SourceAdapter[];

  constructor(cfg: RegistryConfig, log: FastifyBaseLogger) {
    this.adapters = [
      new DrWebAdapter(
        {
          mode: cfg.drwebMode,
          baseUrl: cfg.drwebBaseUrl,
          username: cfg.drwebUsername,
          password: cfg.drwebPassword,
          timeoutMs: 8_000,
        },
        log.child({ adapter: 'drweb' }),
      ),
      new Bitrix24Adapter(cfg.bitrix24WebhookUrl),
      new MailAdapter(cfg.mailHost),
      new ZabbixAdapter(cfg.zabbixApiUrl, cfg.zabbixApiToken),
    ];
  }

  list(): readonly SourceAdapter[] {
    return this.adapters;
  }

  get(id: string): SourceAdapter | undefined {
    return this.adapters.find((a) => a.name === id);
  }

  /** Параллельный опрос с защитой: упавший адаптер не роняет остальных. */
  async gather(): Promise<DashboardPayload> {
    const results = await Promise.allSettled(
      this.adapters.map(async (a) => ({
        status: await a.getStatus(),
        metrics: await a.fetchMetrics(),
        events: await a.fetchEvents(15),
      })),
    );

    const sources: SourceStatus[] = [];
    const metrics: DashboardPayload['metrics'] = [];
    let events: SourceEvent[] = [];

    results.forEach((r, i) => {
      const name = this.adapters[i].name;
      if (r.status === 'fulfilled') {
        sources.push(r.value.status);
        metrics.push(...r.value.metrics);
        events = events.concat(r.value.events);
      } else {
        // Отказоустойчивость: источник недоступен → честный offline-статус
        sources.push({
          source: name,
          health: 'offline',
          lastCheckedAt: new Date().toISOString(),
          message: (r.reason as Error)?.message ?? 'unknown error',
        });
      }
    });

    events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const incidents = events.filter((e) => e.severity === 'critical').slice(0, 20);

    return {
      generatedAt: new Date().toISOString(),
      sources,
      metrics,
      events: events.slice(0, 30),
      incidents,
    };
  }
}

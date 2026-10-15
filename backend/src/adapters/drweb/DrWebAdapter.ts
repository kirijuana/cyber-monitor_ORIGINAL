/**
 * Dr.Web Web API адаптер.
 *
 * Режимы (env DRWEB_MODE):
 *  - mock    — детерминированные данные, работает без сервера (dev/демо)
 *  - live    — реальный Dr.Web Web API: http://host:9080/api/<объект>/<сценарий>.ds?format=json
 *  - auto    — пытается live, при недоступности падает в mock с health='degraded'
 *
 * Live-маппинг сценариев (Dr.Web Enterprise Security Suite 11+):
 *  server.info.ds            → hostname, version, uptime, os, platform
 *  server.statistic.ds       → total/online/offline/activated/newbies
 *  server.resourcesusage.ds  → память / ФС
 *  server.licenseinfo.ds     → ключи лицензий
 *  statistics.ds             → статистика угроз по дням + топ угроз
 *  repository-status.ds      → состояние репозитория
 *  stations.list.ds          → станции (+ installed-components.ds per station)
 *  stations.hips_events.ds   → HIPS-события
 *  quarantine.list.ds        → объекты карантина
 */
import type { FastifyBaseLogger } from 'fastify';
import type { SourceAdapter } from '../base/Adapter.js';
import { makeEvent, makeMetric } from '../base/Adapter.js';
import type {
  DashboardPayload,
  DrWebSnapshot,
  DrWebStation,
  Metric,
  Severity,
  SourceEvent,
  SourceStatus,
} from '../base/types.js';
import { generateMockSnapshot, jitterSnapshot } from './mockData.js';

export interface DrWebAdapterConfig {
  mode: 'mock' | 'live' | 'auto';
  baseUrl: string; // http://host:9080
  username: string;
  password: string;
  timeoutMs: number;
  seed?: number;
}

const DAY_MS = 86_400_000;

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS);
}

function licenseSeverity(expiresAt: string): Severity {
  const d = daysUntil(expiresAt);
  if (d <= 7) return 'critical';
  if (d <= 30) return 'warning';
  return 'ok';
}

export class DrWebAdapter implements SourceAdapter {
  readonly name = 'drweb' as const;
  readonly title = 'Dr.Web Enterprise Security Suite';

  private snapshot: DrWebSnapshot;
  private pollCount = 0;
  private lastOkAt: string | null = null;
  private lastLatencyMs: number | undefined;
  private lastError: string | null = null;
  /** Кэш списка станций (live-режим), mock считает его из snapshot-подобной базы */
  private stationsCache: DrWebStation[] | null = null;

  constructor(
    private readonly cfg: DrWebAdapterConfig,
    private readonly log: FastifyBaseLogger,
  ) {
    this.snapshot = generateMockSnapshot(cfg.seed ?? 20260415);
  }

  /* --------------------------- SourceAdapter API --------------------------- */

  async getStatus(): Promise<SourceStatus> {
    if (this.cfg.mode === 'live') {
      await this.liveHealthCheck();
    } else if (this.cfg.mode === 'auto' && this.lastError) {
      await this.liveHealthCheck(); // авто-восстановление live, когда сервер ожил
    }
    const degraded = this.cfg.mode !== 'mock' && this.lastError !== null;
    const offline = this.cfg.mode === 'live' && this.lastError !== null;
    return {
      source: this.name,
      health: offline ? 'offline' : degraded ? 'degraded' : 'online',
      lastCheckedAt: this.lastOkAt ?? new Date().toISOString(),
      latencyMs: this.lastLatencyMs,
      message: this.lastError ?? (this.cfg.mode === 'mock' ? 'mock data source' : undefined),
    };
  }

  async fetchMetrics(): Promise<Metric[]> {
    const s = await this.getSnapshot();
    const ts = new Date().toISOString();
    const onlinePct = s.stations.total ? (s.stations.online / s.stations.total) * 100 : 0;
    const detected24 = s.threats.at(-1)?.detected ?? 0;
    const fsUsedPct = ((s.resources.fsTotalGb - s.resources.fsFreeGb) / s.resources.fsTotalGb) * 100;
    const memUsedPct = (s.resources.memoryUsedByServerMb / s.resources.memoryTotalMb) * 100;
    const minLicenseDays = Math.min(...s.licenses.map((l) => daysUntil(l.expiresAt)));

    return [
      makeMetric('drweb', 'stations.total', s.stations.total, 'ok', {}, ts),
      makeMetric('drweb', 'stations.online', s.stations.online, onlinePct < 80 ? 'warning' : 'ok', { percent: +onlinePct.toFixed(1) }, ts),
      makeMetric('drweb', 'stations.offline', s.stations.offline, s.stations.offline > 20 ? 'warning' : 'ok', {}, ts),
      makeMetric('drweb', 'stations.newbies', s.stations.newbies, 'ok', {}, ts),
      makeMetric('drweb', 'threats.detected_24h', detected24, detected24 > 40 ? 'warning' : 'ok', {}, ts),
      makeMetric('drweb', 'quarantine.objects', s.quarantine.length, s.quarantine.length > 50 ? 'warning' : 'ok', {}, ts),
      makeMetric('drweb', 'server.memory_used_percent', +memUsedPct.toFixed(1), memUsedPct > 85 ? 'critical' : memUsedPct > 70 ? 'warning' : 'ok', {}, ts),
      makeMetric('drweb', 'server.fs_free_gb', s.resources.fsFreeGb, fsUsedPct > 90 ? 'critical' : fsUsedPct > 80 ? 'warning' : 'ok', {}, ts),
      makeMetric('drweb', 'license.days_to_expiry', minLicenseDays, licenseSeverityFromDays(minLicenseDays), {}, ts),
      makeMetric('drweb', 'repository.state', s.repository.state, s.repository.state === 'up-to-date' ? 'ok' : 'warning', {}, ts),
    ];
  }

  async fetchEvents(limit = 20): Promise<SourceEvent[]> {
    const s = await this.getSnapshot();
    const events: SourceEvent[] = [];

    for (const t of s.topThreats.slice(0, 5)) {
      events.push(
        makeEvent({
          timestamp: t.lastSeenAt,
          source: 'drweb',
          category: 'threat',
          severity: t.count > 30 ? 'critical' : 'warning',
          title: `Обнаружена угроза ${t.name}`,
          description: `${t.count} срабатываний за период`,
          entity: t.name,
        }),
      );
    }
    for (const h of s.hipsEvents.slice(0, 6)) {
      events.push(
        makeEvent({
          timestamp: h.timestamp,
          source: 'drweb',
          category: 'station',
          severity: h.severity,
          title: `HIPS: ${h.action}`,
          description: `${h.stationName} · ${h.subject}`,
          entity: h.stationName,
          id: h.id,
        }),
      );
    }
    for (const l of s.licenses) {
      const d = daysUntil(l.expiresAt);
      if (d <= 30) {
        events.push(
          makeEvent({
            timestamp: new Date().toISOString(),
            source: 'drweb',
            category: 'license',
            severity: licenseSeverity(l.expiresAt),
            title: `Лицензия ${l.key} истекает через ${d} дн.`,
            description: l.product,
            entity: l.key,
          }),
        );
      }
    }
    if (s.repository.state !== 'up-to-date') {
      events.push(
        makeEvent({
          timestamp: s.repository.lastUpdateAt,
          source: 'drweb',
          category: 'repository',
          severity: 'warning',
          title: 'Репозиторий устарел',
          description: `Последнее обновление: ${s.repository.lastUpdateAt}`,
        }),
      );
    }

    return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
  }

  /* ------------------------------ Domain API ------------------------------- */

  /** Публичные методы для REST-роутов Dr.Web-страницы. */
  async getSnapshot(): Promise<DrWebSnapshot> {
    this.pollCount += 1;
    if (this.cfg.mode === 'live') {
      try {
        this.snapshot = await this.fetchLiveSnapshot();
        this.lastOkAt = new Date().toISOString();
        this.lastError = null;
      } catch (err) {
        this.lastError = (err as Error).message;
        this.log.warn({ err }, 'Dr.Web live fetch failed');
      }
    } else if (this.cfg.mode === 'auto') {
      try {
        this.snapshot = await this.fetchLiveSnapshot();
        this.lastOkAt = new Date().toISOString();
        this.lastError = null;
      } catch (err) {
        // fallback на мок, честно помечаем degraded
        this.lastError = (err as Error).message;
        this.snapshot = jitterSnapshot(this.snapshot, Date.now());
      }
    } else {
      this.snapshot = jitterSnapshot(this.snapshot, Date.now() >>> 10);
      this.lastOkAt = new Date().toISOString();
    }
    return this.snapshot;
  }

  async getStations(): Promise<DrWebStation[]> {
    if (this.cfg.mode === 'live') {
      if (!this.stationsCache || this.pollCount % 10 === 1) {
        this.stationsCache = await this.fetchLiveStations();
      }
      return this.stationsCache;
    }
    return this.mockStations();
  }

  /* ------------------------------ Live client ------------------------------ */

  /**
   * Единая точка входа в Dr.Web Web API.
   * POST http://host:9080/api/<object>/<scenario>.ds?format=json
   * Ответ: { head: { status, time, api_version, ... }, data: {...} } | error-блок.
   */
  private async callDs<T = Record<string, unknown>>(
    object: 'server' | 'stations' | 'quarantine',
    scenario: string,
    params: Record<string, string | number> = {},
  ): Promise<T> {
    const url = new URL(`/api/${object}/${scenario}.ds`, this.cfg.baseUrl);
    url.searchParams.set('format', 'json');
    url.searchParams.set('username', this.cfg.username);
    url.searchParams.set('password', this.cfg.password);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

    const started = Date.now();
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.cfg.timeoutMs);
    try {
      const res = await fetch(url, { method: 'POST', signal: ac.signal });
      this.lastLatencyMs = Date.now() - started;
      if (!res.ok) throw new Error(`Dr.Web HTTP ${res.status}`);
      const body = (await res.json()) as {
        head: { status: boolean; error?: { code: string; message: string } };
        data?: T;
      };
      if (!body.head?.status) {
        throw new Error(`Dr.Web API error: ${body.head?.error?.code ?? 'UNKNOWN'} ${body.head?.error?.message ?? ''}`);
      }
      return body.data as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async liveHealthCheck(): Promise<void> {
    try {
      await this.callDs('server', 'info');
      this.lastOkAt = new Date().toISOString();
      this.lastError = null;
    } catch (err) {
      this.lastError = (err as Error).message;
    }
  }

  /* eslint-disable @typescript-eslint/no-explicit-any -- ответы .ds слабо типизированы вендором */
  private async fetchLiveSnapshot(): Promise<DrWebSnapshot> {
    const info = await this.callDs<any>('server', 'info');
    const stat = await this.callDs<any>('server', 'statistic');
    const res = await this.callDs<any>('server', 'resourcesusage');
    const lic = await this.callDs<any>('server', 'licenseinfo');
    const stats = await this.callDs<any>('server', 'statistics');
    const repo = await this.callDs<any>('server', 'repository-status');
    const hips = await this.callDs<any>('stations', 'hips_events', { count: 24 });
    const quar = await this.callDs<any>('quarantine', 'list', { count: 50 });

    const threats: DrWebSnapshot['threats'] = Object.entries(stats?.infections_by_days ?? {}).map(
      ([date, v]: [string, any]) => ({
        date,
        detected: Number(v.detected ?? 0),
        cured: Number(v.cured ?? 0),
        deleted: Number(v.deleted ?? 0),
        quarantined: Number(v.quarantined ?? 0),
        skipped: Number(v.skipped ?? 0),
      }),
    ).sort((a, b) => a.date.localeCompare(b.date));

    return {
      server: {
        hostname: info.hostname ?? 'unknown',
        version: info.version ?? 'unknown',
        apiVersion: info.api_version ?? 'unknown',
        uptimeSeconds: Number(info.uptime ?? 0),
        os: info.os ?? 'unknown',
        platform: info.platform ?? 'unknown',
        serverTime: info.server_time ?? new Date().toISOString(),
        ip: info.ip ?? '',
      },
      resources: {
        memoryTotalMb: Number(res.memory?.total ?? 0),
        memoryFreeMb: Number(res.memory?.free ?? 0),
        memoryUsedByServerMb: Number(res.memory?.used_by_server ?? 0),
        fsTotalGb: Number(res.file_system?.total ?? 0),
        fsFreeGb: Number(res.file_system?.free ?? 0),
      },
      stations: {
        total: Number(stat.total ?? 0),
        online: Number(stat.online ?? 0),
        offline: Number(stat.offline ?? 0),
        activated: Number(stat.activated ?? 0),
        newbies: Number(stat.newbies ?? 0),
      },
      licenses: Object.values(lic?.keys ?? {}).map((k: any) => ({
        key: k.key ?? '',
        product: k.caption ?? '',
        hostsTotal: Number(k.hosts ?? 0),
        hostsUsed: Number(k.used_hosts ?? 0),
        expiresAt: k.end_date ?? '',
        warnings: (k.warnings ?? []).map(String),
      })),
      threats,
      topThreats: Object.entries(stats?.top_infections ?? {}).map(([name, v]: [string, any]) => ({
        name,
        count: Number(v.count ?? 0),
        firstSeenAt: v.first_seen ?? '',
        lastSeenAt: v.last_seen ?? '',
      })).sort((a, b) => b.count - a.count),
      hipsEvents: Object.values(hips?.events ?? {}).map((e: any) => ({
        id: String(e.id),
        stationName: e.station_name ?? '',
        timestamp: e.timestamp ?? '',
        action: e.action ?? '',
        object: e.object ?? '',
        subject: e.subject ?? '',
        severity: mapHipsSeverity(e.severity),
      })),
      quarantine: Object.values(quar?.objects ?? {}).map((q: any) => ({
        id: String(q.id),
        stationUid: q.station_uid ?? '',
        stationName: q.station_name ?? '',
        path: q.path ?? '',
        createdAt: q.created ?? '',
        owner: q.owner ?? '',
        report: q.report ?? '',
        sizeBytes: Number(q.size ?? 0),
      })),
      repository: {
        state: normalizeRepoState(repo?.state),
        lastUpdateAt: repo?.last_update ?? new Date().toISOString(),
        nextUpdateAt: repo?.next_update ?? new Date().toISOString(),
        products: Object.entries(repo?.products ?? {}).map(([name, p]: [string, any]) => ({
          name,
          version: p.version ?? '',
          updatedAt: p.updated ?? '',
          upToDate: Boolean(p.up_to_date),
        })),
      },
    };
  }

  private async fetchLiveStations(): Promise<DrWebStation[]> {
    const list = await this.callDs<any>('stations', 'list');
    return Object.values(list?.stations ?? {}).map((s: any) => ({
      uid: String(s.uid),
      name: s.caption ?? s.name ?? '',
      groupPath: s.group_path ?? '/',
      state: s.state ?? 'enabled',
      online: Boolean(s.enabled_online ?? s.online),
      ip: s.ip_address ?? '',
      os: s.os_caption ?? s.os ?? '',
      agentVersion: s.agent_version ?? '',
      lastSeenAt: s.last_contact ?? null,
      components: Object.keys(s.components ?? {}),
      updateError: Boolean(s.update_error),
    }));
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  /**
   * Станции в mock-режиме: берём детерминированный список из того же seed,
   * что и снапшот (mockData экспортирует станции напрямую — без рассинхрона
   * между KPI-счётчиками и таблицей).
   */
  private mockStations(): DrWebStation[] {
    if (!this.stationsCache) {
      this.stationsCache = generateMockStations(this.cfg.seed ?? 20260415);
    }
    return this.stationsCache;
  }

  /* ------------------------- Actions (live-only API) ----------------------- */

  async stationAction(uid: string, action: 'restart' | 'scan' | 'recover'): Promise<{ ok: boolean; message: string }> {
    if (this.cfg.mode === 'mock') {
      return { ok: true, message: `[mock] Команда "${action}" отправлена станции ${uid}` };
    }
    try {
      await this.callDs('stations', action === 'restart' ? 'reboot' : action === 'scan' ? 'start-scan' : 'restore', { uid });
      return { ok: true, message: `Команда "${action}" отправлена станции ${uid}` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  async quarantineAction(id: string, action: 'delete' | 'restore'): Promise<{ ok: boolean; message: string }> {
    if (this.cfg.mode === 'mock') {
      return { ok: true, message: `[mock] Объект ${id}: ${action} выполнен` };
    }
    try {
      await this.callDs('quarantine', action === 'delete' ? 'delete' : 'restore', { id });
      return { ok: true, message: `Объект ${id}: ${action} выполнен` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}

/* ------------------------------- helpers ---------------------------------- */

function licenseSeverityFromDays(d: number): Severity {
  if (d <= 7) return 'critical';
  if (d <= 30) return 'warning';
  return 'ok';
}

function mapHipsSeverity(raw: unknown): Severity {
  const s = String(raw ?? '').toLowerCase();
  if (s.includes('crit') || s.includes('block') || s.includes('deny')) return 'critical';
  if (s.includes('warn') || s.includes('ask')) return 'warning';
  return 'ok';
}

function normalizeRepoState(raw: unknown): DrWebSnapshot['repository']['state'] {
  const s = String(raw ?? '').toLowerCase();
  if (s.includes('updat')) return 'updating';
  if (s.includes('err')) return 'error';
  if (s.includes('out')) return 'outdated';
  return 'up-to-date';
}

import { generateMockStations } from './mockData.js';

/**
 * Единый доменный контракт всех источников мониторинга.
 * Новый источник = новый адаптер, реализующий SourceAdapter.
 * Ядро (роутер, кэш, фронтовые виджеты) эти типы не меняются.
 */

export type SourceId = 'drweb' | 'bitrix24' | 'mail' | 'zabbix';

export type Severity = 'ok' | 'warning' | 'critical';

export type SourceHealth = 'online' | 'degraded' | 'offline' | 'unconfigured';

/** Единый формат метрики (см. ТЗ). */
export interface Metric {
  /** ISO 8601 */
  timestamp: string;
  source: SourceId;
  /** Двоичное имя: 'stations.online', 'threats.detected_24h', ... */
  metric: string;
  value: number | string;
  severity: Severity;
  metadata?: Record<string, unknown>;
}

export interface SourceStatus {
  source: SourceId;
  health: SourceHealth;
  /** ISO 8601 — когда адаптер последний раз успешно говорил с источником */
  lastCheckedAt: string;
  latencyMs?: number;
  message?: string;
}

export type EventCategory =
  | 'threat'
  | 'station'
  | 'license'
  | 'repository'
  | 'server'
  | 'system';

/** Единый формат события для activity feed / инцидентов. */
export interface SourceEvent {
  id: string;
  timestamp: string; // ISO 8601
  source: SourceId;
  category: EventCategory;
  severity: Severity;
  title: string;
  description?: string;
  /** Сущность, на которую указывает событие: станция, ключ лицензии и т.п. */
  entity?: string;
  metadata?: Record<string, unknown>;
}

/* ------------------------------ Dr.Web domain ------------------------------ */

export interface DrWebServerInfo {
  hostname: string;
  version: string;
  apiVersion: string;
  uptimeSeconds: number;
  os: string;
  platform: string;
  serverTime: string;
  ip: string;
}

export interface DrWebResources {
  memoryTotalMb: number;
  memoryFreeMb: number;
  memoryUsedByServerMb: number;
  fsTotalGb: number;
  fsFreeGb: number;
}

export interface DrWebStationsSummary {
  total: number;
  online: number;
  offline: number;
  activated: number;
  newbies: number;
}

export type StationState = 'enabled' | 'disabled' | 'notactivated' | 'deleted';

export interface DrWebStation {
  uid: string;
  name: string;
  groupPath: string;
  state: StationState;
  online: boolean;
  ip: string;
  os: string;
  agentVersion: string;
  /** ISO 8601 или null, если станция никогда не подключалась */
  lastSeenAt: string | null;
  components: string[];
  updateError: boolean;
}

export interface DrWebLicense {
  key: string;
  product: string;
  hostsTotal: number;
  hostsUsed: number;
  /** ISO 8601 дата окончания действия */
  expiresAt: string;
  warnings: string[];
}

export interface DrWebThreatPoint {
  /** ISO date yyyy-mm-dd */
  date: string;
  detected: number;
  cured: number;
  deleted: number;
  quarantined: number;
  skipped: number;
}

export interface DrWebTopThreat {
  name: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface DrWebHipsEvent {
  id: string;
  stationName: string;
  timestamp: string;
  action: string;
  object: string;
  subject: string;
  severity: Severity;
}

export interface DrWebQuarantineObject {
  id: string;
  stationUid: string;
  stationName: string;
  path: string;
  createdAt: string;
  owner: string;
  report: string;
  sizeBytes: number;
}

export interface DrWebRepositoryProduct {
  name: string;
  version: string;
  updatedAt: string;
  upToDate: boolean;
}

export interface DrWebRepositoryStatus {
  state: 'up-to-date' | 'updating' | 'outdated' | 'error';
  lastUpdateAt: string;
  nextUpdateAt: string;
  products: DrWebRepositoryProduct[];
}

/** Полный снапшот Dr.Web для REST-эндпоинта /api/sources/drweb/snapshot. */
export interface DrWebSnapshot {
  server: DrWebServerInfo;
  resources: DrWebResources;
  stations: DrWebStationsSummary;
  licenses: DrWebLicense[];
  threats: DrWebThreatPoint[];
  topThreats: DrWebTopThreat[];
  hipsEvents: DrWebHipsEvent[];
  quarantine: DrWebQuarantineObject[];
  repository: DrWebRepositoryStatus;
}

/** Агрегированный payload главного дашборда (один запрос — весь экран). */
export interface DashboardPayload {
  generatedAt: string;
  sources: SourceStatus[];
  metrics: Metric[];
  events: SourceEvent[];
  incidents: SourceEvent[];
}

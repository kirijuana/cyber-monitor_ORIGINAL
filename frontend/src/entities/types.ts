/**
 * Фронтенд-зеркало контракта backend (adapters/base/types.ts).
 * Решение: типы дублируются, а не импортируются из backend — фронтовый пакет
 * не должен зависеть от Node-кода. В проде заменить на shared npm-пакет или
 * openapi-typescript-генерацию по схеме backend.
 */

export type SourceId = 'drweb' | 'bitrix24' | 'mail' | 'zabbix';
export type Severity = 'ok' | 'warning' | 'critical';
export type SourceHealth = 'online' | 'degraded' | 'offline' | 'unconfigured';
export type Period = '24h' | '7d' | '30d';

export interface Metric {
  timestamp: string;
  source: SourceId;
  metric: string;
  value: number | string;
  severity: Severity;
  metadata?: Record<string, unknown>;
}

export interface SourceStatus {
  source: SourceId;
  health: SourceHealth;
  lastCheckedAt: string;
  latencyMs?: number;
  message?: string;
}

export type EventCategory = 'threat' | 'station' | 'license' | 'repository' | 'server' | 'system';

export interface SourceEvent {
  id: string;
  timestamp: string;
  source: SourceId;
  category: EventCategory;
  severity: Severity;
  title: string;
  description?: string;
  entity?: string;
  metadata?: Record<string, unknown>;
}

export interface DashboardPayload {
  generatedAt: string;
  sources: SourceStatus[];
  metrics: Metric[];
  events: SourceEvent[];
  incidents: SourceEvent[];
}

/* -------------------------------- Dr.Web ---------------------------------- */

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
  lastSeenAt: string | null;
  components: string[];
  updateError: boolean;
}

export interface DrWebLicense {
  key: string;
  product: string;
  hostsTotal: number;
  hostsUsed: number;
  expiresAt: string;
  warnings: string[];
}

export interface DrWebThreatPoint {
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

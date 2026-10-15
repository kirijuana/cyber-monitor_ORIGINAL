/**
 * Детерминированный генератор моков Dr.Web (seeded PRNG).
 * Используется адаптером в режиме DRWEB_MODE=mock, чтобы локальный запуск
 * выглядел как живая система без реального сервера. Один seed = одинаковые
 * данные между перезапусками — удобно для скриншотов, тестов, демо.
 */
import type {
  DrWebHipsEvent,
  DrWebLicense,
  DrWebQuarantineObject,
  DrWebRepositoryStatus,
  DrWebResources,
  DrWebServerInfo,
  DrWebSnapshot,
  DrWebStation,
  DrWebStationsSummary,
  DrWebThreatPoint,
  DrWebTopThreat,
} from '../base/types.js';

export class Rng {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }
  /** mulberry32 */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}

const HOSTS = [
  'WS', 'PC', 'NB', 'SRV', 'KIOSK', 'ACCOUNTING', 'RECEPTION', 'ENGINEER',
  'DESIGN', 'FINANCE', 'HR', 'WAREHOUSE', 'DIRECTOR', 'LAB', 'TERMINAL',
];
const SUFFIXES = ['-01', '-02', '-03', '-07', '-12', '-15', '-21', '-42', ''];
const OS_LIST = ['Windows 10 Pro', 'Windows 11 Pro', 'Windows Server 2019', 'Astra Linux 1.7', 'ALT Workstation 10'];
const AGENT_VERSIONS = ['11.1.9', '11.1.8', '11.1.7', '13.0.1'];
const GROUPS = ['/Офис', '/Бухгалтерия', '/Серверы', '/Производство', '/Руководство', '/Торговые точки'];
const COMPONENTS_POOL = ['Антивирус Dr.Web', 'Dr.Web Firewall', 'HIPS', 'Родительский контроль', 'Диспетчер питания', 'Шифрование'];
const THREAT_NAMES = [
  'Trojan.Win32.Generic', 'Exploit.CVE-2023-36884', 'Adware.Downloader.MuiOS',
  'Worm.VBS.Stages', 'Backdoor.Linux.XorD.Dos', 'HackTool.Win32.Agent',
  'RISKWARE:WAB.ASM', 'JAVASCRIPT:AdFender.A', 'EMAIL_SCRIPT:VBS.Agent',
  'Trojan.Encoder.39351',
];
const HIPS_ACTIONS = ['Блокировано', 'Разрешено после подтверждения', 'Карантин', 'Запрошено действие пользователя'];
const OWNERS = ['iv Petrov', 'sidorova.a', 'kernel', 'SYSTEM', 'domain\\svc-backup', 'john.doe'];

function isoDaysAgo(days: number, rng: Rng): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(rng.int(8, 18), rng.int(0, 59), rng.int(0, 59));
  return d.toISOString();
}

export function generateMockSnapshot(seed = 20260415): DrWebSnapshot {
  const rng = new Rng(seed);
  const now = new Date().toISOString();

  const server: DrWebServerInfo = {
    hostname: 'av-server-01.corp.local',
    version: '11.1.9-2025091203',
    apiVersion: '11.1.9',
    uptimeSeconds: rng.int(30, 220) * 86_400 + rng.int(0, 86_399),
    os: 'Ubuntu 22.04.4 LTS',
    platform: 'linux-x64',
    serverTime: now,
    ip: '10.10.0.35',
  };

  const memoryTotalMb = 16_384;
  const memoryUsedByServerMb = rng.int(2_100, 4_800);
  const resources: DrWebResources = {
    memoryTotalMb,
    memoryFreeMb: memoryTotalMb - memoryUsedByServerMb - rng.int(3_000, 6_000),
    memoryUsedByServerMb,
    fsTotalGb: 480,
    fsFreeGb: rng.int(48, 210),
  };

  // Станции
  const stations: DrWebStation[] = [];
  const stationCount = 148;
  for (let i = 0; i < stationCount; i++) {
    const name = `${rng.pick(HOSTS)}${String(rng.int(1, 99)).padStart(2, '0')}${rng.pick(SUFFIXES)}`;
    const online = rng.chance(0.82);
    const state = rng.chance(0.955) ? 'enabled' : rng.pick(['disabled', 'notactivated'] as const);
    stations.push({
      uid: `st-${(i + 1).toString().padStart(4, '0')}-${rng.int(1000, 9999)}`,
      name,
      groupPath: rng.pick(GROUPS),
      state,
      online: state === 'enabled' && online,
      ip: `10.${rng.int(10, 12)}.${rng.int(0, 20)}.${rng.int(2, 254)}`,
      os: rng.pick(OS_LIST),
      agentVersion: rng.pick(AGENT_VERSIONS),
      lastSeenAt: state === 'notactivated' ? null : isoDaysAgo(online ? 0 : rng.int(0, 6), rng),
      components: COMPONENTS_POOL.filter(() => rng.chance(0.55)),
      updateError: rng.chance(0.06),
    });
  }

  const total = stations.length;
  const online = stations.filter((s) => s.online).length;
  const activated = stations.filter((s) => s.state !== 'notactivated').length;
  const summary: DrWebStationsSummary = {
    total,
    online,
    offline: total - online,
    activated,
    newbies: rng.int(2, 9),
  };

  // Лицензии: одна истекающая через ~12 дней, одна через 45, остальные далеко
  const licenses: DrWebLicense[] = [
    {
      key: '9F2B-****-****-****-C41D',
      product: 'Dr.Web Enterprise Security Suite (150)',
      hostsTotal: 150,
      hostsUsed: 148,
      expiresAt: isoDaysAgo(-12, rng),
      warnings: ['Истекает срок действия лицензии'],
    },
    {
      key: '77AE-****-****-****-1B03',
      product: 'Dr.Web Enterprise Security Suite (50)',
      hostsTotal: 50,
      hostsUsed: 41,
      expiresAt: isoDaysAgo(-45, rng),
      warnings: [],
    },
    {
      key: 'C1D0-****-****-****-88F4',
      product: 'Dr.Web Mail Security Gateway',
      hostsTotal: 2,
      hostsUsed: 2,
      expiresAt: isoDaysAgo(-220, rng),
      warnings: [],
    },
  ];

  // Угрозы за 30 дней
  const threats: DrWebThreatPoint[] = [];
  for (let d = 29; d >= 0; d--) {
    const base = rng.int(4, 26);
    const spike = d === 3 || d === 11 ? rng.int(25, 60) : 0; // инциденты прошлого
    const detected = base + spike;
    const cured = Math.round(detected * rng.next() * 0.6);
    const quarantined = Math.round((detected - cured) * 0.7);
    const deleted = detected - cured - quarantined;
    const date = new Date();
    date.setDate(date.getDate() - d);
    threats.push({
      date: date.toISOString().slice(0, 10),
      detected,
      cured,
      deleted: Math.max(deleted, 0),
      quarantined,
      skipped: rng.int(0, 3),
    });
  }

  const topThreats: DrWebTopThreat[] = THREAT_NAMES.slice(0, 8)
    .map((name) => ({
      name,
      count: rng.int(2, 64),
      firstSeenAt: isoDaysAgo(rng.int(10, 28), rng),
      lastSeenAt: isoDaysAgo(rng.int(0, 3), rng),
    }))
    .sort((a, b) => b.count - a.count);

  const hipsEvents: DrWebHipsEvent[] = Array.from({ length: 24 }, (_, i) => ({
    id: `hips-${1000 + i}`,
    stationName: rng.pick(stations).name,
    timestamp: isoDaysAgo(rng.int(0, 4), rng),
    action: rng.pick(HIPS_ACTIONS),
    object: `C:\\Users\\${rng.pick(['admin', 'user', 'svc'])}\\AppData\\Local\\Temp\\${rng.pick(['tmp', 'upd', 'cache'])}_${rng.int(100, 999)}.exe`,
    subject: `${rng.pick(HIPS_ACTIONS)}: ${rng.pick(THREAT_NAMES)}`,
    severity: rng.chance(0.25) ? ('critical' as const) : rng.chance(0.5) ? ('warning' as const) : ('ok' as const),
  })).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const quarantine: DrWebQuarantineObject[] = Array.from({ length: 17 }, (_, i) => {
    const st = rng.pick(stations);
    return {
      id: `q-${2000 + i}`,
      stationUid: st.uid,
      stationName: st.name,
      path: `C:\\QUARANTINE\\${isoDaysAgo(rng.int(0, 9), rng).slice(0, 10).replaceAll('-', '')}_${rng.int(1000, 9999)}.bin`,
      createdAt: isoDaysAgo(rng.int(0, 9), rng),
      owner: rng.pick(OWNERS),
      report: rng.pick(THREAT_NAMES),
      sizeBytes: rng.int(2_048, 8_400_000),
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const repository: DrWebRepositoryStatus = {
    state: rng.chance(0.9) ? 'up-to-date' : 'outdated',
    lastUpdateAt: new Date(Date.now() - rng.int(4, 55) * 60_000).toISOString(),
    nextUpdateAt: new Date(Date.now() + rng.int(5, 40) * 60_000).toISOString(),
    products: [
      { name: 'drweb-netmon', version: '11.1.9-250901', updatedAt: isoDaysAgo(0, rng), upToDate: true },
      { name: 'spiderguard', version: '11.1.9-250910', updatedAt: isoDaysAgo(0, rng), upToDate: true },
      { name: 'drweb-kernelmods', version: '11.1.8-250815', updatedAt: isoDaysAgo(2, rng), upToDate: false },
      { name: 'msnet', version: '11.1.9-250911', updatedAt: isoDaysAgo(0, rng), upToDate: true },
      { name: 'drweb-cureit', version: '4.5.1-250905', updatedAt: isoDaysAgo(1, rng), upToDate: true },
    ],
  };

  return {
    server,
    resources,
    stations: summary,
    licenses,
    threats,
    topThreats,
    hipsEvents,
    quarantine,
    repository,
  };
}

export function generateMockStations(seed = 20260415): DrWebStation[] {
  const rng = new Rng(seed ^ 0x5f3a); // независимый под-seed: станции детерминированы сами в себе
  const out: DrWebStation[] = [];
  for (let i = 0; i < 148; i++) {
    const name = `${rng.pick(HOSTS)}${String(rng.int(1, 99)).padStart(2, '0')}${rng.pick(SUFFIXES)}`;
    const online = rng.chance(0.82);
    const state = rng.chance(0.955) ? 'enabled' : rng.pick(['disabled', 'notactivated'] as const);
    out.push({
      uid: `st-${(i + 1).toString().padStart(4, '0')}-${rng.int(1000, 9999)}`,
      name,
      groupPath: rng.pick(GROUPS),
      state,
      online: state === 'enabled' && online,
      ip: `10.${rng.int(10, 12)}.${rng.int(0, 20)}.${rng.int(2, 254)}`,
      os: rng.pick(OS_LIST),
      agentVersion: rng.pick(AGENT_VERSIONS),
      lastSeenAt: state === 'notactivated' ? null : isoDaysAgo(online ? 0 : rng.int(0, 6), rng),
      components: COMPONENTS_POOL.filter(() => rng.chance(0.55)),
      updateError: rng.chance(0.06),
    });
  }
  return out;
}

/** Срез «живого» снапшота: при каждом опросе немного дрейфуют счётчики. */
export function jitterSnapshot(prev: DrWebSnapshot, salt: number): DrWebSnapshot {
  const rng = new Rng(salt >>> 0 || 7);
  const copy: DrWebSnapshot = structuredClone(prev);
  copy.server.serverTime = new Date().toISOString();
  copy.stations.online = Math.min(
    copy.stations.total,
    Math.max(copy.stations.total - 30, copy.stations.online + rng.int(-2, 2)),
  );
  copy.stations.offline = copy.stations.total - copy.stations.online;
  const today = copy.threats[copy.threats.length - 1];
  today.detected += rng.int(0, 2);
  today.cured += rng.chance(0.6) ? 1 : 0;
  copy.repository.lastUpdateAt = new Date(Date.now() - rng.int(1, 59) * 60_000).toISOString();
  return copy;
}

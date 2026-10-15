/**
 * Табы страницы Dr.Web. Разбито по модулям: каждый таб — самостоятельная
 * секция, получает данные через props (данные загружает страница через Query).
 * Никаких fetch внутри табов — презентационный слой + локальный UI-стейт.
 */
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  KeyRound,
  MonitorCog,
  RotateCcw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import type {
  DrWebHipsEvent,
  DrWebLicense,
  DrWebQuarantineObject,
  DrWebRepositoryStatus,
  DrWebSnapshot,
  DrWebStation,
  DrWebTopThreat,
} from '../../entities/types';
import { api } from '../../shared/api/client';
import { cn, daysUntil, formatBytes, formatDate, formatUptime, timeAgo } from '../../shared/lib/format';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ProgressBar } from '../../shared/ui/ProgressBar';
import { StatusBadge } from '../../shared/ui/StatusBadge';
import { DataTable, type Column } from '../../shared/ui/DataTable';
import { SectionHeader } from '../../widgets/kpi';
import { useNow } from '../../shared/ui/Toaster';
import { InfectionsChart } from './InfectionsChart';

/** Честная отметка «данные устарели»: старше двух интервалов опроса. */
function isStale(iso: string | null, now: number): boolean {
  if (!iso) return true;
  return now - new Date(iso).getTime() > 90_000;
}

/* =============================== Tab: Обзор ================================ */

function licenseTone(l: DrWebLicense): { tone: 'ok' | 'warning' | 'critical'; days: number } {
  const days = daysUntil(l.expiresAt);
  if (days <= 7) return { tone: 'critical', days };
  if (days <= 30) return { tone: 'warning', days };
  return { tone: 'ok', days };
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>): void {
  const csv = '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function OverviewTab({ snapshot }: { snapshot: DrWebSnapshot }) {
  const { server, resources, stations, licenses, repository } = snapshot;
  const memUsedPct = Math.round((resources.memoryUsedByServerMb / resources.memoryTotalMb) * 100);
  const fsUsedPct = Math.round(((resources.fsTotalGb - resources.fsFreeGb) / resources.fsTotalGb) * 100);
  const hostsUsedPct = stations.total ? Math.round((stations.activated / stations.total) * 100) : 0;

  const infoRows: Array<[string, string]> = [
    ['Hostname', server.hostname],
    ['IP-адрес', server.ip],
    ['Версия сервера', server.version],
    ['Версия API', server.apiVersion],
    ['Uptime', formatUptime(server.uptimeSeconds)],
    ['ОС', server.os],
    ['Платформа', server.platform],
    ['Время сервера', formatDate(server.serverTime)],
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Server card */}
      <section className="card p-4 lg:col-span-1">
        <SectionHeader title="Сервер управления" caption="agent_server.info.ds" />
        <dl className="mt-3 space-y-1.5 text-sm">
          {infoRows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="truncate font-mono text-[13px] text-ink" title={v}>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Resources */}
      <section className="card p-4 lg:col-span-1">
        <SectionHeader title="Ресурсы сервера" caption="server.resourcesusage.ds" />
        <div className="mt-4 space-y-5">
          <div>
            <ProgressBar
              value={memUsedPct}
              tone={memUsedPct > 85 ? 'crit' : memUsedPct > 70 ? 'warn' : 'ok'}
              label="Память (использует сервер)"
              right={`${memUsedPct}%`}
            />
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>Сервер: {resources.memoryUsedByServerMb} МБ</span>
              <span>Всего: {resources.memoryTotalMb} МБ · Свободно: {resources.memoryFreeMb} МБ</span>
            </div>
          </div>
          <div>
            <ProgressBar
              value={fsUsedPct}
              tone={fsUsedPct > 90 ? 'crit' : fsUsedPct > 80 ? 'warn' : 'ok'}
              label="Файловая система"
              right={`${fsUsedPct}%`}
            />
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>Свободно: {resources.fsFreeGb} ГБ</span>
              <span>Всего: {resources.fsTotalGb} ГБ</span>
            </div>
          </div>
          <div>
            <ProgressBar value={hostsUsedPct} tone="accent" label="Активировано станций" right={`${hostsUsedPct}%`} />
            <div className="mt-1 text-xs text-muted">
              {stations.activated} из {stations.total} станций под лицензией
            </div>
          </div>
        </div>
      </section>

      {/* Licenses */}
      <section className="card p-4 lg:col-span-1">
        <SectionHeader
          title="Лицензии"
          caption="server.licenseinfo.ds"
          right={
            <Button variant="subtle" size="sm" onClick={() =>
              downloadCsv('drweb-licenses.csv', [
                ['Ключ', 'Продукт', 'Хостов', 'Использовано', 'Окончание'],
                ...licenses.map((l) => [l.key, l.product, l.hostsTotal, l.hostsUsed, l.expiresAt]),
              ])}>
              Экспорт CSV
            </Button>
          }
        />
        <div className="mt-3 space-y-3">
          {licenses.map((l) => {
            const { tone, days } = licenseTone(l);
            return (
              <div key={l.key} className="rounded-lg border border-line bg-elevated p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <KeyRound className="size-3.5 shrink-0 text-muted" />
                      <span className="truncate">{l.product}</span>
                    </div>
                    <div className="mt-0.5 truncate font-mono text-xs text-muted" title={l.key}>{l.key}</div>
                  </div>
                  <StatusBadge severity={tone}>{days > 0 ? `${days} дн.` : 'просрочен'}</StatusBadge>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted">
                  <span>{l.hostsUsed}/{l.hostsTotal} хостов</span>
                  <span>до {formatDate(l.expiresAt)}</span>
                </div>
                {l.warnings.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {l.warnings.map((w) => (
                      <li key={w} className="flex items-start gap-1.5 text-xs text-warn">
                        <AlertTriangle className="mt-0.5 size-3 shrink-0" /> {w}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-xs">
            <span className="text-muted">Репозиторий баз</span>
            <span className="flex items-center gap-2">
              <StatusBadge severity={repository.state === 'up-to-date' ? 'ok' : repository.state === 'error' ? 'critical' : 'warning'}>{repository.state}</StatusBadge>
              <span className="text-muted">{timeAgo(repository.lastUpdateAt, Date.now())}</span>
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ============================== Tab: Станции =============================== */

type StationsFilter = { query: string; state: 'all' | 'online' | 'offline' | 'update_error' };

export function StationsTab({
  stations,
  canMutate,
  onAction,
}: {
  stations: DrWebStation[];
  canMutate: boolean;
  onAction: (msg: string) => void;
}) {
  const [filter, setFilter] = useState<StationsFilter>({ query: '', state: 'all' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const now = useNow(30_000); // «минутная» точность давности без ре-рендера каждую секунду

  const filtered = useMemo(() => {
    const q = filter.query.trim().toLowerCase();
    return stations.filter((s) => {
      if (filter.state === 'online' && !s.online) return false;
      if (filter.state === 'offline' && s.online) return false;
      if (filter.state === 'update_error' && !s.updateError) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.ip.includes(q) || s.groupPath.toLowerCase().includes(q) || s.os.toLowerCase().includes(q);
    });
  }, [stations, filter]);

  const toggleAll = () => {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((s) => s.uid))));
  };
  const toggleOne = (uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  async function runAction(action: 'restart' | 'scan' | 'recover', uids: string[]) {
    if (!canMutate || uids.length === 0) return;
    setBusy(true);
    try {
      const results = await Promise.allSettled(uids.map((uid) => api.stationAction(uid, action)));
      const ok = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
      onAction(`${action}: ${ok}/${uids.length} команд принято`);
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  const cols: Column<DrWebStation>[] = [
    {
      key: 'sel',
      header: (
        <input
          type="checkbox"
          aria-label="Выбрать все"
          className="size-3.5 accent-cyan-500"
          checked={filtered.length > 0 && selected.size === filtered.length}
          onChange={toggleAll}
        />
      ),
      render: (s) => (
        <input
          type="checkbox"
          aria-label={`Выбрать ${s.name}`}
          className="size-3.5 accent-cyan-500"
          checked={selected.has(s.uid)}
          onChange={() => toggleOne(s.uid)}
        />
      ),
      sortable: false,
      className: 'w-8',
    },
    { key: 'name', header: 'Станция', render: (s) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{s.name}</div>
          <div className="truncate text-xs text-muted">{s.ip}</div>
        </div>
      ) },
    { key: 'group', header: 'Группа', render: (s) => <span className="text-muted">{s.groupPath}</span> },
    { key: 'state', header: 'Статус', render: (s) => (
        <span className="inline-flex items-center gap-1.5">
          <StatusBadge severity={s.online ? 'ok' : s.state === 'notactivated' ? 'warning' : 'critical'}>
            {s.online ? 'Online' : s.state === 'notactivated' ? 'Не активирована' : 'Offline'}
          </StatusBadge>
          {s.updateError && <StatusBadge severity="warning">Ошибка обновления</StatusBadge>}
        </span>
      ) },
    { key: 'lastSeen', header: 'Последний сигнал', sortValue: (s) => s.lastSeenAt ?? '', render: (s) => {
        if (!s.lastSeenAt) return <span className="text-muted">никогда</span>;
        const stale = isStale(s.lastSeenAt, now);
        return <span className={cn('tabular-nums', stale && !s.online && 'text-warn')} title={s.lastSeenAt}>{timeAgo(s.lastSeenAt, now)}</span>;
      } },
    { key: 'os', header: 'ОС', render: (s) => <span className="text-muted">{s.os}</span> },
    { key: 'version', header: 'Версия агента', sortValue: (s) => s.agentVersion, render: (s) => <span className="font-mono text-xs">{s.agentVersion}</span> },
    { key: 'components', header: 'Компоненты', sortable: false, render: (s) => (
        <div className="flex max-w-[220px] flex-wrap gap-1">
          {s.components.slice(0, 3).map((c) => (
            <span key={c} className="rounded bg-elevated px-1.5 py-0.5 text-[10px] text-muted">{c}</span>
          ))}
          {s.components.length > 3 && <span className="text-[10px] text-muted">+{s.components.length - 3}</span>}
        </div>
      ) },
    {
      key: 'actions',
      header: <span className="sr-only">Действия</span>,
      sortable: false,
      render: (s) => (
        <span className="inline-flex gap-1">
          <Button variant="ghost" size="sm" disabled={!canMutate || busy} title="Перезагрузить"
            onClick={() => runAction('restart', [s.uid])}><MonitorCog className="size-3.5" /></Button>
          <Button variant="ghost" size="sm" disabled={!canMutate || busy} title="Запустить сканирование"
            onClick={() => runAction('scan', [s.uid])}><ShieldAlert className="size-3.5" /></Button>
          <Button variant="ghost" size="sm" disabled={!canMutate || busy} title="Восстановить связь"
            onClick={() => runAction('recover', [s.uid])}><RotateCcw className="size-3.5" /></Button>
        </span>
      ),
    },
  ];

  return (
    <section className="card p-4" data-stations-count={filtered.length} data-updated-at={new Date().toISOString()}>
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <input
          data-hotkey="search"
          value={filter.query}
          onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))}
          placeholder="Поиск: имя, IP, группа, ОС…"
          className="h-8 w-64 rounded-lg border border-line bg-elevated px-3 text-sm outline-none focus:border-accent"
        />
        <div className="flex rounded-lg border border-line p-0.5">
          {(['all', 'online', 'offline', 'update_error'] as const).map((st) => (
            <button key={st} onClick={() => setFilter((f) => ({ ...f, state: st }))}
              className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                filter.state === st ? 'bg-elevated text-accent' : 'text-muted hover:text-ink')}>
              {st === 'all' ? 'Все' : st === 'online' ? 'Online' : st === 'offline' ? 'Offline' : 'Ошибки обновления'}
            </button>
          ))}
        </div>
        <Button variant="subtle" size="sm" onClick={() =>
          downloadCsv('drweb-stations.csv', [
            ['Имя', 'IP', 'Группа', 'Статус', 'Последний сигнал', 'ОС', 'Версия', 'Компоненты'],
            ...filtered.map((st) => [st.name, st.ip, st.groupPath, st.online ? 'online' : 'offline', st.lastSeenAt ?? '', st.os, st.agentVersion, st.components.join('; ')]),
          ])}>Экспорт CSV</Button>
        <span className="ml-auto text-xs text-muted">{filtered.length} из {stations.length}</span>
        {canMutate && selected.size > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2 py-1">
            <span className="text-xs font-medium text-accent">{selected.size} выбрано:</span>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => runAction('scan', [...selected])}>Сканировать</Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => runAction('restart', [...selected])}>Перезагрузить</Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => runAction('recover', [...selected])}>Восстановить</Button>
          </span>
        )}
      </div>
      {(
        <DataTable
          columns={cols}
          rows={filtered}
          rowKey={(s) => s.uid}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          initialSort={{ key: 'name', dir: 'asc' }}
          maxHeightPx={520}
          emptyState={<EmptyState title="Станции не найдены" hint="Попробуйте изменить фильтры или поисковый запрос." />}
        />
      )}
    </section>
  );
}

/* ========================= Tab: Угрозы и события ========================== */

type ChartPeriod = '7d' | '30d' | 'all';

export function ThreatsTab({ snapshot }: { snapshot: DrWebSnapshot }) {
  const [hipsQuery, setHipsQuery] = useState('');
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('30d');
  const chartThreats = useMemo(() => {
    if (chartPeriod === 'all') return snapshot.threats;
    const days = chartPeriod === '7d' ? 7 : 30;
    return snapshot.threats.slice(-days);
  }, [snapshot.threats, chartPeriod]);
  const hips = useMemo(() => {
    const q = hipsQuery.trim().toLowerCase();
    if (!q) return snapshot.hipsEvents;
    return snapshot.hipsEvents.filter((e) =>
      e.stationName.toLowerCase().includes(q) || e.object.toLowerCase().includes(q) || e.action.toLowerCase().includes(q));
  }, [snapshot.hipsEvents, hipsQuery]);

  const topCols: Column<DrWebTopThreat>[] = [
    { key: 'name', header: 'Угроза', render: (t) => <span className="font-medium">{t.name}</span> },
    { key: 'count', header: 'Срабатываний', className: 'text-right', sortValue: (t) => t.count,
      render: (t) => <span className="block text-right tabular-nums font-medium">{t.count}</span> },
    { key: 'first', header: 'Первое', sortValue: (t) => t.firstSeenAt, render: (t) => <span className="text-muted">{formatDate(t.firstSeenAt)}</span> },
    { key: 'last', header: 'Последнее', sortValue: (t) => t.lastSeenAt, render: (t) => <span className="tabular-nums">{timeAgo(t.lastSeenAt, Date.now())}</span> },
  ];

  const hipsCols: Column<DrWebHipsEvent>[] = [
    { key: 'ts', header: 'Время', sortValue: (e) => e.timestamp, render: (e) => <span className="tabular-nums text-muted">{formatDate(e.timestamp)}</span> },
    { key: 'station', header: 'Станция', render: (e) => e.stationName },
    { key: 'severity', header: 'Severity', render: (e) => (
        <StatusBadge severity={e.severity}>{e.severity}</StatusBadge>) },
    { key: 'action', header: 'Действие HIPS', render: (e) => <span className="font-mono text-xs">{e.action}</span> },
    { key: 'object', header: 'Объект', sortable: false, render: (e) => <span className="block max-w-[280px] truncate font-mono text-xs text-muted" title={e.object}>{e.object}</span> },
    { key: 'subject', header: 'Инициатор', sortable: false, render: (e) => <span className="block max-w-[220px] truncate font-mono text-xs text-muted" title={e.subject}>{e.subject}</span> },
  ];

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <SectionHeader
          title="Срабатывания по дням"
          caption="infections-chart.ds / statistics.ds"
          right={
            <span className="flex items-center gap-2">
              <span className="flex rounded-lg border border-line p-0.5">
                {(['7d', '30d', 'all'] as const).map((p) => (
                  <button key={p} onClick={() => setChartPeriod(p)}
                    className={cn('rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
                      chartPeriod === p ? 'bg-elevated text-accent' : 'text-muted hover:text-ink')}>
                    {p === 'all' ? 'Всё' : p}
                  </button>
                ))}
              </span>
              <Button variant="subtle" size="sm" onClick={() =>
                downloadCsv('drweb-infections.csv', [
                  ['Дата', 'Обнаружено', 'Полечено', 'Удалено', 'Карантин', 'Пропущено'],
                  ...chartThreats.map((t) => [t.date, t.detected, t.cured, t.deleted, t.quarantined, t.skipped]),
                ])}>
                Экспорт CSV
              </Button>
            </span>
          }
        />
        <div className="mt-3"><InfectionsChart threats={chartThreats} /></div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card p-4">
          <SectionHeader title="Топ угроз" caption="statistics.ds" right={
            <Button variant="subtle" size="sm" onClick={() =>
              downloadCsv('drweb-top-threats.csv', [
                ['Угроза', 'Срабатываний', 'Первое', 'Последнее'],
                ...snapshot.topThreats.map((t) => [t.name, t.count, t.firstSeenAt, t.lastSeenAt]),
              ])}>Экспорт CSV</Button>} />
          <div className="mt-2">
            <DataTable columns={topCols} rows={snapshot.topThreats} rowKey={(t) => t.name} initialSort={{ key: 'count', dir: 'desc' }} maxHeightPx={320} />
          </div>
        </section>
        <section className="card p-4">
          <div className="flex items-center justify-between gap-2">
            <SectionHeader title="HIPS-события" caption="hips_events.ds" />
            <input
              data-hotkey="search"
              value={hipsQuery}
              onChange={(e) => setHipsQuery(e.target.value)}
              placeholder="Фильтр: станция, объект…"
              className="h-8 w-52 rounded-lg border border-line bg-elevated px-3 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="mt-2">
            <DataTable
              columns={hipsCols}
              rows={hips}
              rowKey={(e) => e.id}
              initialSort={{ key: 'ts', dir: 'desc' }}
              maxHeightPx={320}
              emptyState={<EmptyState title="Событий нет" hint="Нет HIPS-событий по текущему фильтру." />}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

/* ============================= Tab: Карантин =============================== */

export function QuarantineTab({
  objects,
  canMutate,
  onAction,
}: {
  objects: DrWebQuarantineObject[];
  canMutate: boolean;
  onAction: (msg: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return objects;
    return objects.filter((o) => o.path.toLowerCase().includes(q) || o.stationName.toLowerCase().includes(q) || o.owner.toLowerCase().includes(q));
  }, [objects, query]);

  const toggleOne = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () =>
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((o) => o.id))));

  async function run(action: 'delete' | 'restore', ids: string[]) {
    if (!canMutate || ids.length === 0) return;
    setBusy(true);
    try {
      const res = await Promise.allSettled(ids.map((id) => api.quarantineAction(id, action)));
      const ok = res.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
      onAction(`Карантин ${action}: выполнено ${ok}/${ids.length}`);
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  const cols: Column<DrWebQuarantineObject>[] = [
    { key: 'sel', header: (
        <input type="checkbox" aria-label="Выбрать всё" className="size-3.5 accent-cyan-500"
          checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} />),
      render: (o) => (
        <input type="checkbox" aria-label={`Выбрать ${o.id}`} className="size-3.5 accent-cyan-500"
          checked={selected.has(o.id)} onChange={() => toggleOne(o.id)} />),
      sortable: false, className: 'w-8' },
    { key: 'path', header: 'Путь', render: (o) => (
        <div className="min-w-0">
          <div className="block max-w-[320px] truncate font-mono text-xs" title={o.path}>{o.path}</div>
          <div className="text-xs text-muted">{formatBytes(o.sizeBytes)}</div>
        </div>) },
    { key: 'station', header: 'Станция', render: (o) => o.stationName },
    { key: 'owner', header: 'Владелец', render: (o) => <span className="text-muted">{o.owner}</span> },
    { key: 'created', header: 'Помещён', sortValue: (o) => o.createdAt, render: (o) => <span className="tabular-nums text-muted">{formatDate(o.createdAt)}</span> },
    { key: 'report', header: 'Отчёт', sortable: false, render: (o) => (
        <span className="block max-w-[240px] truncate text-xs text-muted" title={o.report}>{o.report}</span>) },
    { key: 'actions', header: '', sortable: false, render: (o) => (
        <span className="inline-flex gap-1">
          <Button variant="ghost" size="sm" disabled={!canMutate || busy} title="Восстановить"
            onClick={() => run('restore', [o.id])}><Check className="size-3.5" /></Button>
          <Button variant="ghost" size="sm" disabled={!canMutate || busy} title="Удалить"
            onClick={() => run('delete', [o.id])}><Trash2 className="size-3.5 text-danger" /></Button>
        </span>) },
  ];

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <input
          data-hotkey="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск: путь, станция, владелец…"
          className="h-8 w-64 rounded-lg border border-line bg-elevated px-3 text-sm outline-none focus:border-accent"
        />
        <span className="text-xs text-muted">{filtered.length} объектов</span>
        <Button className="ml-auto" variant="subtle" size="sm" onClick={() =>
          downloadCsv('drweb-quarantine.csv', [
            ['Путь', 'Станция', 'Владелец', 'Помещён', 'Размер, Б', 'Отчёт'],
            ...filtered.map((o) => [o.path, o.stationName, o.owner, o.createdAt, o.sizeBytes, o.report]),
          ])}>Экспорт CSV</Button>
        {canMutate && selected.size > 0 && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2 py-1">
            <span className="text-xs font-medium text-accent">{selected.size} выбрано:</span>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => run('restore', [...selected])}>Восстановить</Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => run('delete', [...selected])}>Удалить</Button>
          </span>
        )}
      </div>
      {(
        <DataTable
          columns={cols}
          rows={filtered}
          rowKey={(o) => o.id}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          initialSort={{ key: 'created', dir: 'desc' }}
          maxHeightPx={520}
          emptyState={<EmptyState title="Карантин пуст" hint="Объектов по текущему фильтру не найдено. Проверьте фильтры или обновите данные." />}
        />
      )}
    </section>
  );
}

/* ============================ Tab: Репозиторий ============================= */

export function RepositoryTab({ repository }: { repository: DrWebRepositoryStatus }) {
  const prodCols: Column<DrWebRepositoryStatus['products'][number]>[] = [
    { key: 'name', header: 'Продукт', render: (p) => <span className="font-medium">{p.name}</span> },
    { key: 'version', header: 'Версия БД', render: (p) => <span className="font-mono text-xs">{p.version}</span> },
    { key: 'updated', header: 'Обновлено', sortValue: (p) => p.updatedAt,
      render: (p) => <span className="tabular-nums text-muted">{timeAgo(p.updatedAt, Date.now())}</span> },
    { key: 'state', header: 'Статус', render: (p) => (
        <StatusBadge severity={p.upToDate ? 'ok' : 'warning'}>{p.upToDate ? 'Актуально' : 'Устарело'}</StatusBadge>) },
  ];

  // История обновлений строим из продуктов: это честная производная,
  // а не выдуманный источник (у Web API нет единого history-сценария).
  const history = useMemo(
    () => [...repository.products].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8),
    [repository.products],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="card p-4">
        <SectionHeader title="Состояние репозитория" caption="repository-status.ds" />
        <div className="mt-3 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted">Статус</span>
            <StatusBadge severity={repository.state === 'up-to-date' ? 'ok' : repository.state === 'error' ? 'critical' : 'warning'}>{repository.state}</StatusBadge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Последнее обновление</span>
            <span className="tabular-nums">{formatDate(repository.lastUpdateAt)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Следующее по плану</span>
            <span className="tabular-nums">{formatDate(repository.nextUpdateAt)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Продуктов в реестре</span>
            <span className="tabular-nums font-medium">{repository.products.length}</span>
          </div>
        </div>
      </section>

      <section className="card p-4 lg:col-span-2">
        <SectionHeader title="Продукты и история обновлений" caption="drweb-up.conf / products" />
        <div className="mt-2">
          <DataTable columns={prodCols} rows={repository.products} rowKey={(p) => p.name} initialSort={{ key: 'updated', dir: 'desc' }} maxHeightPx={360} />
        </div>
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Последние обновления</div>
          <ol className="space-y-1.5">
            {history.map((p) => (
              <li key={p.name} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{p.name} <span className="font-mono text-xs text-muted">{p.version}</span></span>
                <span className="shrink-0 tabular-nums text-xs text-muted">{formatDate(p.updatedAt)}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}

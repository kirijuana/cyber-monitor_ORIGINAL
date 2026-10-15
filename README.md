# Инфра-Монитор — централизованный мониторинг ИТ-инфраструктуры

MVP: главный дашборд (сводка по всем системам) + страница Dr.Web ESS.
Архитектура рассчитана на подключение новых источников (Bitrix24, Mail, Zabbix) без правки ядра.

## Стек

| Слой      | Технология                                  |
|-----------|---------------------------------------------|
| Frontend  | React 18 + TypeScript + Vite + Tailwind CSS |
| Данные    | TanStack Query (polling 45 c) + Zustand     |
| Графики   | Recharts                                    |
| Backend   | Node.js 20 + Fastify + TypeScript           |
| Auth      | JWT (роли admin / viewer)                   |
| Источники | Адаптеры (`SourceAdapter`), mock/live       |

## Быстрый старт (dev)

Требуется: **Node.js >= 20**.

```bash
# 1. Backend (порт 8090)
cd backend
cp .env.example .env        # при желании отредактируйте
npm install
npm run dev                 # http://localhost:8090

# 2. Frontend (порт 5173, в другом терминале)
cd frontend
npm install
npm run dev                 # откройте http://localhost:5173
```

Vite проксирует `/api/*` на `http://localhost:8090`, поэтому бэкенд-адрес во фронтенде настраивать не нужно.

**Вход:** `admin / admin` (viewer: `viewer / viewer`). Задаётся через `ADMIN_PASSWORD` / `VIEWER_PASSWORD` в `backend/.env`.

По умолчанию Dr.Web работает в режиме **mock** (`DRWEB_MODE=mock`) — данные генерируются детерминированно, система полностью кликабельна без реального сервера.

## Подключение реального Dr.Web ESS

1. Включите Web API на сервере Dr.Web (порт 9080 http / 9081 https).
2. Создайте пользователя с правами только на чтение (например, `monitor`).
3. В `backend/.env`:

```ini
DRWEB_MODE=live
DRWEB_BASE_URL=http://<host-drweb>:9080
DRWEB_USERNAME=monitor
DRWEB_PASSWORD=<секрет>   # ключ хранится только server-side
```

4. Перезапустите бэкенд. Если сервер недоступен — UI честно покажет «Source unavailable», не падая.

## Как добавить новый источник (< 1 дня)

1. Создайте `backend/src/adapters/<name>/index.ts` с реализацией интерфейса `SourceAdapter`:

```ts
interface SourceAdapter {
  readonly name: string;
  getStatus(): Promise<SourceStatus>;
  fetchMetrics(): Promise<Metric[]>;
  fetchEvents(limit?: number): Promise<EventItem[]>;
}
```

2. Зарегистрируйте адаптер в реестре: `backend/src/adapters/registry.ts`.
3. На стороне UI добавьте одну строку в `frontend/src/shared/config/constants.ts` (`SOURCES`) и, при наличии страницы, роут в `frontend/src/app/routes.tsx`.

Ядро (роуты `/api/dashboard`, агрегация, дизайн-система) менять не нужно.

## Команды

```bash
# backend
npm run dev          # tsx watch
npm run build        # tsc -> dist/
npm start            # node dist/server.js
npm test             # vitest (auth + mockData)
npm run typecheck

# frontend
npm run dev          # vite
npm run build        # tsc -b && vite build -> dist/
npm run preview      # раздать dist локально
npm run typecheck
```

## Структура проекта

```
backend/src/
├── adapters/
│   ├── base/         # SourceAdapter, Metric, типы единого формата
│   ├── drweb/        # Dr.Web Web API адаптер (live) + mock-генератор
│   ├── bitrix24/     # заглушка (unconfigured)
│   ├── mail/         # заглушка (unconfigured)
│   ├── zabbix/       # заглушка (unconfigured)
│   └── registry.ts   # реестр источников
├── plugins/auth.ts   # JWT, роли admin/viewer
├── routes/api.ts     # /api/auth/login, /api/dashboard, /api/sources, /api/drweb/*
├── config.ts         # env-конфиг
└── server.ts

frontend/src/
├── app/              # роутинг, layout, провайдеры (QueryClient, theme, toast)
├── pages/
│   ├── Dashboard/    # статус-бар, KPI, график угроз, activity feed, инциденты
│   └── DrWeb/        # табы: Обзор / Станции / Угрозы / Карантин / Репозиторий
├── widgets/          # KpiSection, ActivityFeed, ThreatChart, IncidentsTable
├── features/         # refresh, фильтры, авто-обновление
├── entities/         # Station, Threat, License, Metric, Period, Severity
└── shared/
    ├── ui/           # дизайн-система: Badge, Card, KPI, Sparkline, Table, Skeleton, Toast…
    ├── api/          # HTTP-клиент (Bearer + /api proxy)
    ├── lib/          # форматирование времени, cn(), утилиты
    └── config/       # SOURCES, PERIODS, APP_CONFIG
```

## UX-шорткаты

- `/` — фокус на поиск, `R` — ручной refresh, `Esc` — закрыть модалки/поиск.
- Авто-обновление каждые 45 с; устаревшие данные (>90 с) помечаются «Stale · N min ago».

## Продакшен-сборка

```bash
cd frontend && npm run build     # статику из dist/ раздаёт любой nginx/caddy
cd backend  && npm run build && NODE_ENV=production node dist/server.js
```

Примечание: docker-compose для связки nginx(frontend/dist) + backend можно добавить следующим шагом; локальный запуск через `npm run dev` покрывает MVP.

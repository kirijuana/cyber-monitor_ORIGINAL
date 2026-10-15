import 'dotenv/config';
import type { RegistryConfig } from './adapters/base/registry.js';

function env(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

export const config = {
  port: Number(env('PORT', '8090')),
  host: env('HOST', '0.0.0.0'),
  /**
   * MVP-аутентификация: два захардкоженных пользователя за HMAC-JWT.
   * В проде заменить на LDAP/OIDC — интерфейс verify() в plugins/auth.ts изолирован.
   */
  auth: {
    secret: env('JWT_SECRET', 'dev-only-insecure-secret-change-me'),
    users: [
      { username: 'admin', password: env('ADMIN_PASSWORD', 'admin'), role: 'admin' as const },
      { username: 'viewer', password: env('VIEWER_PASSWORD', 'viewer'), role: 'viewer' as const },
    ],
    tokenTtlSec: 8 * 3600,
  },
  registry: {
    drwebMode: (env('DRWEB_MODE', 'mock') as RegistryConfig['drwebMode']),
    drwebBaseUrl: env('DRWEB_BASE_URL', 'http://localhost:9080'),
    drwebUsername: env('DRWEB_USERNAME', 'monitor'),
    drwebPassword: env('DRWEB_PASSWORD', ''),
    drwebTlsInsecure: env('DRWEB_TLS_INSECURE', 'false') === 'true',
    bitrix24WebhookUrl: env('BITRIX24_WEBHOOK_URL') || undefined,
    mailHost: env('MAIL_HOST') || undefined,
    zabbixApiUrl: env('ZABBIX_API_URL') || undefined,
    zabbixApiToken: env('ZABBIX_API_TOKEN') || undefined,
  } satisfies RegistryConfig,
};

export type AppConfig = typeof config;

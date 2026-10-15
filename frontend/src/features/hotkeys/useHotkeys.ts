/**
 * Клавиатурные шорткаты уровня приложения:
 *   / — фокус в поиск (страница регистрирует input через data-hotkey="search")
 *   r — refresh (callback от страницы; поддержана русская раскладка — «к»)
 *   Esc — закрытие попапов/очистка поиска
 * Игнорируются, когда фокус внутри поля ввода.
 */
import { useEffect } from 'react';

export interface HotkeyHandlers {
  onRefresh?: () => void;
  onEscape?: () => void;
}

export function useHotkeys(handlers: HotkeyHandlers): void {
  useEffect(() => {
    const inField = () => {
      const el = document.activeElement;
      return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        handlers.onEscape?.();
        if (inField()) (document.activeElement as HTMLElement).blur();
        return;
      }
      if (inField()) return;
      if (e.key === '/') {
        e.preventDefault();
        const search = document.querySelector<HTMLInputElement>('[data-hotkey="search"]');
        search?.focus();
      } else if (e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'к') {
        e.preventDefault();
        handlers.onRefresh?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}

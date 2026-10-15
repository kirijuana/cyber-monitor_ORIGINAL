/**
 * Хук авто-обновления: мгновенный refetch при возврате на вкладку.
 * Интервал задаётся через refetchInterval в useQuery (TanStack Query).
 */
import { useEffect } from 'react';

export function useVisibilityRefetch(refetch: () => void): void {
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refetch]);
}

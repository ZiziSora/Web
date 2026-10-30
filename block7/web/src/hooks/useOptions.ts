import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import { PAGE_SIZE } from '../config/pagination';
import type { Option, OptionsPage } from '../types/api';

export function useOptions(resource: 'chefs' | 'ingredients', q: string) {
  const [state, set] = useState<{ q: string; items: Option[]; cursor: number | null; hasMore: boolean; loading: boolean; error?: ApiError }>({ q, items: [], cursor: null, hasMore: false, loading: true });
  const controller = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const current = useRef(q);
  current.current = q;
  const fetchPage = useCallback(async (term: string, after: number, reset: boolean) => {
    if (!reset && lock.current) return;
    if (reset) controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    lock.current = true;
    set(old => reset ? { q: term, items: [], cursor: null, hasMore: false, loading: true } : { ...old, loading: true, error: undefined });
    try {
      const params = new URLSearchParams({ q: term, limit: String(PAGE_SIZE) });
      if (after) params.set('after', String(after));
      const data = await api<OptionsPage>(`/${resource}/options?${params}`, { signal: request.signal });
      if (!request.signal.aborted && current.current === term) set(old => ({ q: term, items: [...new Map([...(reset ? [] : old.items), ...data.items].map(item => [item.id, item])).values()], cursor: data.nextCursor, hasMore: data.hasMore, loading: false }));
    } catch (error) {
      if (!request.signal.aborted && current.current === term) set(old => ({ ...old, loading: false, error: error as ApiError }));
    } finally {
      if (controller.current === request) lock.current = false;
    }
  }, [resource]);
  useEffect(() => {
    void fetchPage(q, 0, true);
    return () => controller.current?.abort();
  }, [q, fetchPage]);
  const visible = state.q === q ? state : { q, items: [], cursor: null, hasMore: false, loading: true };
  return { ...visible, loadMore: () => {
    if (visible.hasMore || visible.error) void fetchPage(q, visible.cursor ?? 0, !visible.items.length);
  } };
}

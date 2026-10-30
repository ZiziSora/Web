import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { api, ApiError, type Entity, type Resource } from '../api';
import { PAGE_SIZE } from '../config/pagination';
import type { Page } from '../types/api';

export function usePagedList(resource: Resource, guest = false) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const request = new URLSearchParams();
  for (const key of ['q', 'sort', 'category', 'minPrice', 'maxPrice', 'available']) {
    const value = params.get(key);
    if (value) request.set(key, value);
  }
  request.set('pageSize', String(PAGE_SIZE));
  request.set('mode', guest ? 'fulltext' : resource === 'dishes' ? 'advanced' : 'basic');
  if (guest) request.set('fallback', 'fuzzy');
  const signature = resource + '?' + request.toString();
  const raw = params.get('page');
  const page = raw && /^[1-9]\d*$/.test(raw) && Number(raw) <= 2147483647 ? raw : '1';
  request.set('page', page);
  const key = resource + '?' + request.toString();
  const [attempt, retry] = useState(0);
  const [state, set] = useState<{ key: string; signature: string; data?: Page<Entity>; error?: ApiError; loading: boolean }>({ key, signature, loading: true });
  const active = useRef(key);
  active.current = key;
  useEffect(() => {
    const controller = new AbortController();
    set(old => ({ key, signature, data: old.signature === signature ? old.data : undefined, loading: true }));
    api<Page<Entity>>('/' + key, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted && active.current === key) set({ key, signature, data, loading: false });
    }).catch(error => {
      if (!controller.signal.aborted && active.current === key) set(old => ({ ...old, error, loading: false }));
    });
    return () => controller.abort();
  }, [key, signature, attempt]);
  const data = state.signature === signature ? state.data : undefined;
  const loading = state.key !== key || state.loading;
  useEffect(() => {
    if (!data || loading || state.error) return;
    const expected = data.meta.page === 1 ? null : String(data.meta.page);
    if (raw !== expected || params.getAll('page').length > 1) {
      const next = new URLSearchParams(params);
      next.delete('page');
      if (expected) next.set('page', expected);
      setParams(next, { replace: true, state: location.state });
    }
  }, [data, loading, raw, params, setParams, location.state, state.error]);
  return { data, loading, error: state.key === key ? state.error : undefined, retry: () => retry(n => n + 1), signature };
}

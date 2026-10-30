import { useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { api, type Entity } from '../api';
import { PAGE_SIZE } from '../config/pagination';
import type { Page } from '../types/api';
import { filterClientRows } from '../utils/client-list';
import { useLoad } from './useLoad';

export function useClientPagedList(resource: 'chefs' | 'ingredients') {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  // The load key excludes page/search/sort: those operations only change local data.
  const s = useLoad(resource, signal => api<Entity[]>('/' + resource + '/all', { signal }));
  const q = params.get('q') ?? '';
  const sort = params.get('sort') ?? '';
  const signature = resource + '?' + new URLSearchParams({ q, sort });
  const raw = params.get('page');
  const requestedPage = raw && /^[1-9]\d*$/.test(raw) && Number(raw) <= 2147483647 ? Number(raw) : 1;
  const rows = useMemo(() => filterClientRows(s.data ?? [], q, sort), [s.data, q, sort]);
  const data = useMemo<Page<Entity> | undefined>(() => {
    if (!s.data) return undefined;
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(requestedPage, pages);
    return {
      items: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      meta: { page, pageSize: PAGE_SIZE, total, pages, effectiveMode: 'basic' },
    };
  }, [s.data, rows, requestedPage]);
  useEffect(() => {
    if (!data || s.loading || s.error) return;
    const expected = data.meta.page === 1 ? null : String(data.meta.page);
    if (raw !== expected || params.getAll('page').length > 1) {
      const next = new URLSearchParams(params);
      next.delete('page');
      if (expected) next.set('page', expected);
      setParams(next, { replace: true, state: location.state });
    }
  }, [data, s.loading, s.error, raw, params, setParams, location.state]);
  return { ...s, data, signature };
}

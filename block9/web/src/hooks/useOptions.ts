import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { PAGE_SIZE } from '../config/pagination';
import type { Option } from '../types/api';
import { filterClientRows } from '../utils/client-list';
import { useLoad } from './useLoad';

export function useOptions(resource: 'chefs' | 'ingredients', q: string) {
  const s = useLoad(resource, signal => api<Option[]>(`/${resource}/options/all`, { signal }));
  const key = resource + ':' + q;
  const [visible, setVisible] = useState({ key, count: PAGE_SIZE });
  useEffect(() => setVisible({ key, count: PAGE_SIZE }), [key]);
  const count = visible.key === key ? visible.count : PAGE_SIZE;
  const rows = useMemo(() => filterClientRows(s.data ?? [], q), [s.data, q]);
  const items = useMemo(() => rows.slice(0, count), [rows, count]);
  const hasMore = count < rows.length;
  return {
    items, hasMore, total: rows.length, loading: s.loading, error: s.error,
    loadMore: () => {
      if (s.error) { s.retry(); return; }
      if (!s.loading && hasMore) setVisible(old => ({ key, count: (old.key === key ? old.count : PAGE_SIZE) + PAGE_SIZE }));
    },
  };
}

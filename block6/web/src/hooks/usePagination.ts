import { useEffect, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
export const PAGE_SIZE = 6;
export function usePagination(total?: number) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const raw = params.get('page');
  const parsed = raw && /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : 1;
  const pages = Math.max(1, Math.ceil((total ?? 0) / PAGE_SIZE));
  const page = total === undefined ? parsed : Math.min(parsed, pages);
  const q = params.get('q') ?? '';
  const previous = useRef({ page, q });
  useEffect(() => {
    if (total === undefined) return;
    const expected = page === 1 ? null : String(page);
    if (raw !== expected || params.getAll('page').length > 1) {
      const next = new URLSearchParams(params);
      next.delete('page');
      if (expected) next.set('page', expected);
      setParams(next, { replace: true, state: location.state });
    }
  }, [total, page, raw, params, setParams, location.state]);
  useEffect(() => {
    const old = previous.current;
    previous.current = { page, q };
    if (old.q === q && old.page !== page && total !== undefined) {
      headingRef.current?.focus({ preventScroll: true });
      headingRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }, [page, q, total]);
  return { page, pages, start: (page - 1) * PAGE_SIZE, headingRef };
}

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePageKeys } from '../hooks/usePageKeys';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { PAGE_SIZE } from '../config/pagination';
export function Pagination({ page, pages, total, loading = false }: { page: number; pages: number; total: number; loading?: boolean }) {
  const { previousRef, nextRef } = usePageKeys();
  const [params] = useSearchParams();
  const location = useLocation();
  if (!total) return null;
  const href = (n: number) => {
    const next = new URLSearchParams(params);
    next.delete('page');
    if (n > 1) next.set('page', String(n));
    return { pathname: location.pathname, search: next.toString() ? '?' + next.toString() : '' };
  };
  const first = Math.max(1, Math.min(page - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => first + i);
  const items = [...new Set([1, ...numbers, pages])];
  return <div className="pagination-panel" onClickCapture={event => { if (loading) event.preventDefault(); }}><p className="pagination-summary" aria-live="polite">Hiển thị {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} trên {total} mục</p>{pages > 1 && <nav className="pagination" aria-label="Phân trang" aria-busy={loading}>
    {page > 1 ? <Link to={href(page - 1)} state={location.state} rel="prev" aria-disabled={loading} ref={previousRef} aria-keyshortcuts="ArrowLeft" title="Trang trước (←)"><ChevronLeft aria-hidden="true" focusable="false" /> Trước</Link> : <span aria-disabled="true"><ChevronLeft aria-hidden="true" focusable="false" /> Trước</span>}
    <span className="pagination-numbers">{items.map((n, i) => <span className="page-item" key={n}>{i > 0 && n > items[i - 1] + 1 && <span className="page-gap" aria-hidden="true">…</span>}<Link to={href(n)} state={location.state} aria-label={'Trang ' + n} aria-disabled={loading} aria-current={n === page ? 'page' : undefined}>{n}</Link></span>)}</span>
    <span className="pagination-mobile">Trang {page}/{pages}</span>
    {page < pages ? <Link to={href(page + 1)} state={location.state} rel="next" aria-disabled={loading} ref={nextRef} aria-keyshortcuts="ArrowRight" title="Trang sau (→)">Sau <ChevronRight aria-hidden="true" focusable="false" /></Link> : <span aria-disabled="true">Sau <ChevronRight aria-hidden="true" focusable="false" /></span>}
  </nav>}</div>;
}

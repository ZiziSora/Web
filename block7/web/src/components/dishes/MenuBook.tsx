import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePageKeys } from '../../hooks/usePageKeys';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject, type MouseEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { type Entity } from '../../api';
import { DishGrid } from './DishGrid';
import { BookSkeletonLeaves } from './MenuSkeleton';

type Flip = { from: number; target: number; dishes: Entity[]; duration: number; desktop: boolean };
export function MenuBook({ dishes, page, pages, total, headingRef, loading = false }: { dishes: Entity[]; page: number; pages: number; total: number; headingRef: RefObject<HTMLHeadingElement | null>; loading?: boolean }) {
  const { previousRef, nextRef } = usePageKeys();
  const [params] = useSearchParams();
  const location = useLocation();
  const [flip, setFlip] = useState<Flip | null>(null);
  const locked = useRef(false);
  const previous = useRef({ page, dishes });
  const focus = () => headingRef.current?.focus({ preventScroll: true });
  useLayoutEffect(() => {
    const old = previous.current;
    if (old.page !== page) {
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        locked.current = true;
        const distance = Math.min(Math.abs(page - old.page) - 1, 5);
        const desktop = matchMedia('(min-width: 1024px)').matches;
        const duration = desktop ? 520 + distance * 65 : 300 + distance * 35;
        setFlip({ from: old.page, target: page, dishes: old.dishes, duration, desktop });
      } else focus();
    }
    previous.current = { page, dishes };
  }, [page, dishes]);
  const finish = () => { locked.current = false; setFlip(null); focus(); };
  useEffect(() => {
    if (!loading && !flip) locked.current = false;
  }, [loading, flip]);
  useEffect(() => {
    if (!flip) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const timer = window.setTimeout(finish, flip.duration + 100);
    window.addEventListener('resize', finish);
    window.addEventListener('popstate', finish);
    media.addEventListener('change', finish);
    return () => { clearTimeout(timer); window.removeEventListener('resize', finish); window.removeEventListener('popstate', finish); media.removeEventListener('change', finish); };
  }, [flip]);
  const href = (target: number) => {
    const next = new URLSearchParams(params); next.delete('page');
    if (target > 1) next.set('page', String(target));
    return { pathname: location.pathname, search: next.toString() ? '?' + next.toString() : '' };
  };
  function turn(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = Number(new URL(event.currentTarget.href).searchParams.get('page') ?? 1);
    if (locked.current || loading || target === page) { event.preventDefault(); return; }
    locked.current = true;
  }
  const leaf = (items: Entity[], offset: number) => <div className="book-leaf"><p className="book-running-title" aria-hidden="true">THE TABLE · THỰC ĐƠN</p><DishGrid dishes={items} startIndex={offset} /></div>;
  const forward = flip ? flip.target > flip.from : true;
  const left = flip?.desktop && forward ? { items: flip.dishes.slice(0,3), page: flip.from } : { items: dishes.slice(0,3), page };
  const right = flip?.desktop && !forward ? { items: flip.dishes.slice(3), page: flip.from } : { items: dishes.slice(3), page };
  return <div className={'menu-book' + (loading ? ' loading-view' : '')} aria-busy={!!flip || loading}>
    {loading && <span className="sr-only" role="status">Đang tải trang thực đơn…</span>}
    <div className="book-binding"><div className="book-content">{loading ? <BookSkeletonLeaves /> : <>{leaf(left.items, (left.page-1)*6)}{leaf(right.items, (right.page-1)*6+3)}</>}</div>
      {flip && !loading && <div className={'book-turn ' + (forward ? 'turn-forward' : 'turn-back')} style={{ '--book-turn-duration': flip.duration + 'ms' } as CSSProperties} data-distance={Math.abs(flip.target-flip.from)} onAnimationEnd={event => { if (event.target === event.currentTarget) finish(); }} aria-hidden="true" inert>
        <div className="turn-front">{flip.desktop ? leaf(forward ? flip.dishes.slice(3) : flip.dishes.slice(0,3), (flip.from-1)*6+(forward?3:0)) : <>{leaf(flip.dishes.slice(0,3),(flip.from-1)*6)}{leaf(flip.dishes.slice(3),(flip.from-1)*6+3)}</>}</div>
        <div className="turn-reverse">{leaf(forward ? dishes.slice(0,3) : dishes.slice(3), (page-1)*6+(forward?0:3))}</div>
      </div>}
    </div>
    <div className="book-footer"><p className="pagination-summary" aria-live="polite">Hiển thị {(page-1)*6+1}–{Math.min(page*6,total)} trên {total} mục</p>
    {pages > 1 && <nav className="book-controls" aria-label="Phân trang">
      {page > 1 ? <Link to={href(page-1)} state={location.state} rel="prev" ref={previousRef} aria-keyshortcuts="ArrowLeft" title="Trang trước (←)" onClick={e=>turn(e)} aria-disabled={!!flip || loading}><ChevronLeft aria-hidden="true" focusable="false" /> Trang trước</Link> : <span aria-disabled="true"><ChevronLeft aria-hidden="true" focusable="false" /> Trang trước</span>}
      <span className="book-page-numbers">{[...new Set([1, ...Array.from({ length: Math.min(5, pages) }, (_, i) => Math.max(1, Math.min(page - 2, pages - 4)) + i), pages])].map((n, i, all) => <span key={n}>{i > 0 && n > all[i - 1] + 1 && <span aria-hidden="true">…</span>}<Link to={href(n)} state={location.state} aria-label={'Trang ' + n} aria-current={n === page ? 'page' : undefined} onClick={e => turn(e)} aria-disabled={!!flip || loading}>{n}</Link></span>)}</span><span className="book-page-mobile">Trang {page}/{pages}</span>
      {page < pages ? <Link to={href(page+1)} state={location.state} rel="next" ref={nextRef} aria-keyshortcuts="ArrowRight" title="Trang sau (→)" onClick={e=>turn(e)} aria-disabled={!!flip || loading}>Trang sau <ChevronRight aria-hidden="true" focusable="false" /></Link> : <span aria-disabled="true">Trang sau <ChevronRight aria-hidden="true" focusable="false" /></span>}
    </nav>}</div>
  </div>;
}

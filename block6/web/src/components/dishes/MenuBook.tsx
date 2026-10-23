import { useEffect, useRef, useState, type RefObject, type MouseEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { type Entity } from '../../api';
import { DishGrid } from './DishGrid';

type Flip = { from: number; target: number; dishes: Entity[] };
export function MenuBook({ dishes, page, pages, total, headingRef }: { dishes: Entity[]; page: number; pages: number; total: number; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const [params] = useSearchParams();
  const location = useLocation();
  const [flip, setFlip] = useState<Flip | null>(null);
  const locked = useRef(false);
  const previous = useRef(page);
  const focus = () => headingRef.current?.focus({ preventScroll: true });
  useEffect(() => {
    if (previous.current !== page && !locked.current) focus();
    previous.current = page;
  }, [page]);
  useEffect(() => {
    if (!flip) return;
    const finish = () => { locked.current = false; setFlip(null); focus(); };
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const timer = window.setTimeout(finish, matchMedia('(min-width: 1024px)').matches ? 450 : 250);
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
  function turn(event: MouseEvent<HTMLAnchorElement>, target: number) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (locked.current) { event.preventDefault(); return; }
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      locked.current = true; setFlip({ from: page, target, dishes });
    }
  }
  const leaf = (items: Entity[], offset: number) => <div className="book-leaf"><p className="book-running-title" aria-hidden="true">THE TABLE · THỰC ĐƠN</p><DishGrid dishes={items} startIndex={offset} /></div>;
  const forward = flip ? flip.target > flip.from : true;
  return <div className="menu-book" aria-busy={!!flip}>
    <div className="book-binding"><div className="book-content">{leaf(dishes.slice(0,3), (page-1)*6)}{leaf(dishes.slice(3), (page-1)*6+3)}</div>
      {flip && <div className={'book-turn ' + (forward ? 'turn-forward' : 'turn-back')} aria-hidden="true" inert>
        <div className="turn-front">{leaf(forward ? flip.dishes.slice(3) : flip.dishes.slice(0,3), (flip.from-1)*6+(forward?3:0))}</div>
        <div className="turn-reverse">{leaf(forward ? dishes.slice(0,3) : dishes.slice(3), (page-1)*6+(forward?0:3))}</div>
      </div>}
    </div>
    <div className="book-footer"><p className="pagination-summary" aria-live="polite">Hiển thị {(page-1)*6+1}–{Math.min(page*6,total)} trên {total} mục</p>
    {pages > 1 && <nav className="book-controls" aria-label="Phân trang">
      {page > 1 ? <Link to={href(page-1)} state={location.state} rel="prev" onClick={e=>turn(e,page-1)} aria-disabled={!!flip}>Trang trước</Link> : <span aria-disabled="true">Trang trước</span>}
      <span aria-live="polite">Lượt {page}/{pages}</span>
      {page < pages ? <Link to={href(page+1)} state={location.state} rel="next" onClick={e=>turn(e,page+1)} aria-disabled={!!flip}>Trang sau</Link> : <span aria-disabled="true">Trang sau</span>}
    </nav>}</div>
  </div>;
}

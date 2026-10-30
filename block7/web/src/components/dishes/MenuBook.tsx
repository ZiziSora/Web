import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useSearchParams } from 'react-router-dom';
import { type Entity } from '../../api';
import { Pagination } from '../Pagination';
import { DishGrid } from './DishGrid';
import { BookLoadingPages } from './MenuLoading';

type Flip = { from: number; target: number; dishes: Entity[]; duration: number; desktop: boolean };
export function MenuBook({ dishes, page, pages, total, headingRef, onRetry, loading = false }: { dishes: Entity[]; page: number; pages: number; total: number; headingRef: RefObject<HTMLHeadingElement | null>; onRetry: () => void; loading?: boolean }) {
  const [params] = useSearchParams();
  const raw = params.get('page');
  const requested = raw && /^[1-9]\d*$/.test(raw) && Number(raw) <= 2147483647 ? Number(raw) : 1;
  // Compare the URL target with the last loaded page, including Back/Forward.
  const loadingDirection = Math.min(requested, pages) < page ? 'back' : 'forward';
  const [flip, setFlip] = useState<Flip | null>(null);
  const busy = loading || !!flip;
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
  function beginTurn(target: number) {
    if (locked.current || busy || target === page) return false;
    locked.current = true;
    return true;
  }
  const leaf = (items: Entity[], offset: number) => <div className="book-leaf"><p className="book-running-title" aria-hidden="true">THE TABLE · THỰC ĐƠN</p><DishGrid dishes={items} startIndex={offset} /></div>;
  const forward = flip ? flip.target > flip.from : true;
  const left = flip?.desktop && forward ? { items: flip.dishes.slice(0, 3), page: flip.from } : { items: dishes.slice(0, 3), page };
  const right = flip?.desktop && !forward ? { items: flip.dishes.slice(3), page: flip.from } : { items: dishes.slice(3), page };
  return <div className="menu-book" aria-busy={!!flip || loading}>
    <div className="book-binding">{loading ? <BookLoadingPages direction={loadingDirection} /> : <div className="book-content">{leaf(left.items, (left.page - 1) * 6)}{leaf(right.items, (right.page - 1) * 6 + 3)}</div>}
      {flip && !loading && <div className={'book-turn ' + (forward ? 'turn-forward' : 'turn-back')} style={{ '--book-turn-duration': flip.duration + 'ms' } as CSSProperties} data-distance={Math.abs(flip.target - flip.from)} onAnimationEnd={event => { if (event.target === event.currentTarget) finish(); }} aria-hidden="true" inert>
        <div className="turn-front">{flip.desktop ? leaf(forward ? flip.dishes.slice(3) : flip.dishes.slice(0, 3), (flip.from - 1) * 6 + (forward ? 3 : 0)) : <>{leaf(flip.dishes.slice(0, 3), (flip.from - 1) * 6)}{leaf(flip.dishes.slice(3), (flip.from - 1) * 6 + 3)}</>}</div>
        <div className="turn-reverse">{leaf(forward ? dishes.slice(0, 3) : dishes.slice(3), (page - 1) * 6 + (forward ? 0 : 3))}</div>
      </div>}
    </div>
    <Pagination page={page} pages={pages} total={total} loading={loading} disabled={!!flip} context="thực đơn" onBeforeChange={beginTurn} onRetry={onRetry} />
  </div>;
}

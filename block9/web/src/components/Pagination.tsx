import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { usePageKeys } from '../hooks/usePageKeys';
import { PAGE_SIZE } from '../config/pagination';

type Props = {
  page: number;
  pages: number;
  total: number;
  loading?: boolean;
  disabled?: boolean;
  context?: string;
  onBeforeChange?: (target: number) => boolean;
  onRetry?: () => void;
};

/** One pagination UI for the menu and all management lists. */
export function Pagination({ page, pages, total, loading = false, disabled = false, context = 'danh sách', onBeforeChange, onRetry }: Props) {
  const { previousRef, nextRef } = usePageKeys();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const id = useId();
  const raw = params.get('page');
  const requested = raw && /^[1-9]\d*$/.test(raw) && Number(raw) <= 2147483647 ? Number(raw) : 1;
  const selected = loading ? Math.min(requested, pages) : page;
  const busy = loading || disabled;
  const [input, setInput] = useState(String(selected));
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  useLayoutEffect(() => {
    setInput(String(selected));
    setError('');
  }, [selected, pages, location.key]);
  useEffect(() => { if (!busy) lock.current = false; }, [busy, location.key]);

  const href = (target: number) => {
    const next = new URLSearchParams(params);
    next.delete('page');
    if (target > 1) next.set('page', String(target));
    return { pathname: location.pathname, search: next.toString() ? '?' + next.toString() : '' };
  };
  function begin(target: number) {
    if (lock.current || busy || target === page || onBeforeChange?.(target) === false) return false;
    lock.current = true;
    return true;
  }
  function click(event: MouseEvent<HTMLAnchorElement>, target: number) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!begin(target)) { event.preventDefault(); return; }
    if (target === requested && target !== page && onRetry) { event.preventDefault(); onRetry(); }
  }
  const first = Math.max(1, Math.min(selected - 2, pages - 4));
  const numbers = [...new Set([1, ...Array.from({ length: Math.min(5, pages) }, (_, i) => first + i), pages])];
  if (!total) return null;
  return <div className="pagination-panel book-footer">
    {pages > 1 && <div className="book-pagination"><nav className="book-controls" aria-label="Phân trang" aria-busy={busy}>
      {selected > 1 ? <Link className="book-prev" aria-label="Trang trước" to={href(selected - 1)} state={location.state} rel="prev" ref={previousRef} aria-keyshortcuts="ArrowLeft" title="Trang trước (←)" onClick={event => click(event, selected - 1)} aria-disabled={busy}><ChevronLeft aria-hidden="true" /> Trước</Link> : <span className="book-prev" aria-disabled="true"><ChevronLeft aria-hidden="true" /> Trước</span>}
      <span className="book-page-numbers">{numbers.map((n, index) => <span key={n}>{index > 0 && n > numbers[index - 1] + 1 && <span aria-hidden="true">…</span>}<Link to={href(n)} state={location.state} aria-label={'Trang ' + n} aria-current={n === selected ? 'page' : undefined} aria-disabled={busy} onClick={event => click(event, n)}>{n}</Link></span>)}</span>
      {selected < pages ? <Link className="book-next" aria-label="Trang sau" to={href(selected + 1)} state={location.state} rel="next" ref={nextRef} aria-keyshortcuts="ArrowRight" title="Trang sau (→)" onClick={event => click(event, selected + 1)} aria-disabled={busy}>Sau <ChevronRight aria-hidden="true" /></Link> : <span className="book-next" aria-disabled="true">Sau <ChevronRight aria-hidden="true" /></span>}
      <form className="book-jump" aria-label={'Đi tới trang ' + context} noValidate onSubmit={event => {
        event.preventDefault();
        if (lock.current || busy) return;
        const value = input.trim();
        const target = Number(value);
        if (!/^\d+$/.test(value) || !Number.isSafeInteger(target) || target < 1 || target > pages) {
          setError(`Nhập số nguyên từ 1 đến ${pages}.`);
          inputRef.current?.focus();
          return;
        }
        setError('');
        setInput(String(target));
        if (!begin(target)) return;
        if (target === requested && target !== page && onRetry) onRetry();
        else navigate(href(target), { state: location.state });
      }}><div className="book-jump-row"><label htmlFor={id}>Trang</label><input ref={inputRef} id={id} name="page" aria-label="Đi tới trang" type="text" inputMode="numeric" value={input} disabled={busy} autoComplete="off" aria-invalid={!!error} aria-describedby={id + '-total' + (error ? ' ' + id + '-error' : '')} onChange={event => { setInput(event.target.value); setError(''); }} onFocus={event => event.currentTarget.select()} onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} /><span className="sr-only" id={id + '-total'}>Tổng cộng {pages} trang</span><button className="book-jump-submit" type="submit" disabled={busy}>Đi tới</button></div>{error && <p className="field-error" id={id + '-error'} role="alert">{error}</p>}</form>
    </nav></div>}
    <p className="pagination-summary" aria-live="polite">{loading ? `Đang tải trang ${selected}…` : `Hiển thị ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} trên ${total} mục`}</p>
  </div>;
}

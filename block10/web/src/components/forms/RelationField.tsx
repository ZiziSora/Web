import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { labels } from '../../api';
import type { Option } from '../../types/api';
import { useOptions } from '../../hooks/useOptions';

export function RelationField({ g, selected, error, onChange }: { g: { key: string; title: string; items: Option[]; resource: string }; selected: number[]; error?: string; onChange: (ids: number[]) => void }) {
  const resource = g.resource as 'chefs' | 'ingredients';
  const infinite = resource === 'ingredients';
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => { const timer = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const s = useOptions(resource, q);
  const [known, setKnown] = useState(() => new Map(g.items.map(item => [item.id, item])));
  useEffect(() => { if (s.items.length) setKnown(old => new Map([...old, ...s.items.map(item => [item.id, item] as const)])); }, [s.items]);
  const root = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const load = useRef(s.loadMore);
  load.current = s.loadMore;
  useEffect(() => {
    if (!infinite || !s.hasMore || s.loading || s.error || !sentinel.current || search.trim() !== q) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) load.current(); }, { root: root.current, threshold: 0.1 });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [infinite, s.hasMore, s.loading, s.error, q, search]);
  return <fieldset className="relation-fieldset" aria-invalid={!!error} aria-describedby={error ? g.key + '-error' : undefined} tabIndex={error ? -1 : undefined}>
    <legend>{g.title}</legend><p className="field-hint">Đã chọn {selected.length} · Có thể chọn nhiều hoặc để trống.</p>
    {selected.length > 0 && <ul className="selected-options" aria-label={'Đã chọn ' + labels[resource]}>{selected.map(id => <li key={id}><span>{known.get(id)?.name ?? g.items.find(item => item.id === id)?.name ?? '#' + id}</span><button type="button" aria-label={'Bỏ chọn ' + (known.get(id)?.name ?? '#' + id)} onClick={() => onChange(selected.filter(value => value !== id))}><X aria-hidden="true" /></button></li>)}</ul>}
    <label className="relation-search"><span>Tìm {labels[resource]}</span><input type="search" value={search} maxLength={200} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); setQ(search.trim()); } }} onChange={event => setSearch(event.target.value)} placeholder="Nhập tên, có thể không dấu…" /></label>
    <p className="field-hint">{infinite ? 'Cuộn trong danh sách để xem thêm nguyên liệu.' : 'Bấm Tải thêm để xem tiếp đầu bếp.'}</p>
    <div ref={root} className="checkbox-list options-scroll" tabIndex={0} role="region" aria-label={'Danh sách chọn ' + labels[resource]} aria-busy={s.loading || search.trim() !== q}>
      {s.items.map(item => <label className="checkbox-option" key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={event => onChange(event.target.checked ? [...selected, item.id] : selected.filter(id => id !== item.id))} /><span>{item.name}{item.unit && <small>{item.unit}</small>}</span></label>)}
      {!s.loading && !s.error && !s.items.length && <p className="field-hint">{q ? 'Không tìm thấy tên phù hợp.' : 'Chưa có dữ liệu. Bạn có thể để trống và bổ sung sau.'}</p>}
      <div ref={sentinel} className="options-sentinel" aria-hidden="true" />
      {s.loading && <p role="status" className="field-hint">Đang tải…</p>}
    </div>
    <div className="options-footer"><p className="field-hint" aria-live="polite">Hiển thị {s.items.length} / {s.total} mục{!s.hasMore && !s.loading && !s.error && s.items.length > 0 ? ' · Đã hết danh sách' : ''}</p>
      {s.error && <p role="alert" className="field-error">{s.error.message}</p>}
      {(s.hasMore || s.error) && <button type="button" className="button secondary" disabled={s.loading || search.trim() !== q} onClick={s.loadMore}>{s.error ? 'Thử lại' : s.loading ? 'Đang tải…' : 'Tải thêm'}</button>}
    </div>
    {error && <p className="field-error" id={g.key + '-error'}>{error}</p>}
  </fieldset>;
}

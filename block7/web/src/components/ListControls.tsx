import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { api, labels, type Resource } from '../api';
import { useLoad } from '../hooks/useLoad';
import { money } from '../utils/money';

const keys = ['q', 'category', 'minPrice', 'maxPrice', 'available', 'sort'] as const;
type Key = typeof keys[number];
type Values = Record<Key, string>;
const read = (params: URLSearchParams) => Object.fromEntries(keys.map(key => [key, params.get(key) ?? ''])) as Values;
function validate(values: Values) {
  const errors: Partial<Record<Key, string>> = {};
  for (const key of ['minPrice', 'maxPrice'] as const) {
    if (values[key] && !/^\d{1,10}(\.\d{1,2})?$/.test(values[key])) errors[key] = 'Nhập giá từ 0 đến 9.999.999.999,99 VNĐ, tối đa 2 số thập phân (dùng dấu chấm).';
  }
  if (!errors.minPrice && !errors.maxPrice && values.minPrice && values.maxPrice && Number(values.minPrice) > Number(values.maxPrice)) errors.maxPrice = 'Giá đến phải lớn hơn hoặc bằng giá từ.';
  return errors;
}

export function ListControls({ resource, guest = false }: { resource: Resource; guest?: boolean }) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const id = useId();
  const applied = read(params);
  // Navigation makes the URL authoritative immediately, including pending timers.
  const [edit, setEdit] = useState({ source: location.key, values: applied });
  const draft = edit.source === location.key ? edit.values : applied;
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({});
  const visibleErrors = edit.source === location.key ? errors : {};
  const [composing, setComposing] = useState(false);
  const composingRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(() => matchMedia('(min-width: 768px)').matches);
  const facets = useLoad(resource, signal => resource === 'dishes' ? api<{ categories: string[] }>('/dishes/facets', { signal }) : Promise.resolve({ categories: [] }));
  const dirty = keys.some(key => draft[key].trim() !== applied[key]);
  const activeKeys = keys.filter(key => key !== 'sort' && applied[key]);
  const filterCount = activeKeys.filter(key => key !== 'q').length;
  const filtering = keys.some(key => applied[key]);
  const ranked = guest && !!draft.q.trim();

  function commit(values: Values, replace: boolean) {
    clearTimeout(timer.current);
    const normalized = Object.fromEntries(keys.map(key => [key, values[key].trim()])) as Values;
    const nextErrors = validate(normalized);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) setFiltersOpen(true);
    if (Object.keys(nextErrors).length || composingRef.current) return;
    if (keys.every(key => normalized[key] === applied[key])) return;
    const next = new URLSearchParams(params);
    next.delete('page');
    for (const key of keys) {
      next.delete(key);
      if (normalized[key]) next.set(key, normalized[key]);
    }
    setParams(next, { replace, state: location.state });
  }

  useEffect(() => {
    clearTimeout(timer.current);
    setEdit({ source: location.key, values: read(new URLSearchParams(location.search)) });
    setErrors({});
    composingRef.current = false;
    setComposing(false);
  }, [location.key]);

  useEffect(() => {
    if (!dirty || composing || edit.source !== location.key) return;
    timer.current = setTimeout(() => commit(draft, true), 300);
    return () => clearTimeout(timer.current);
  }, [edit, location.key, composing]);

  function field(key: Key, value: string, immediate = false) {
    const values = { ...draft, [key]: value };
    setEdit({ source: location.key, values });
    setErrors({});
    if (immediate) commit(values, false);
  }
  function remove(key?: Key) {
    const values = key ? { ...applied, [key]: '' } : read(new URLSearchParams());
    setEdit({ source: location.key, values });
    setErrors({});
    commit(values, false);
    if (key === 'q' || !key) searchRef.current?.focus();
  }
  const chipLabel = (key: Key) => key === 'q' ? `Từ khóa: ${applied.q}` : key === 'category' ? `Danh mục: ${applied.category}` : key === 'minPrice' ? `Từ ${money(applied.minPrice)}` : key === 'maxPrice' ? `Đến ${money(applied.maxPrice)}` : applied.available === 'true' ? 'Đang phục vụ' : 'Tạm hết';

  return <form className="query-controls" role="search" aria-label={guest ? 'Tìm kiếm thực đơn' : 'Tìm kiếm ' + labels[resource]} noValidate onKeyDown={event => {
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      if (!event.nativeEvent.isComposing && !composingRef.current) commit(draft, false);
    }
  }} onSubmit={event => {
    event.preventDefault();
    commit(draft, false);
  }}>
    <div className="query-main">
      <div className="query-search"><label htmlFor={id + '-q'}>{guest ? 'Tìm món' : 'Tìm ' + labels[resource]}</label>
        <div className="query-search-input"><Search aria-hidden="true" /><input ref={searchRef} id={id + '-q'} type="search" name="q" maxLength={200} value={draft.q} onChange={event => field('q', event.target.value)} onCompositionStart={() => { clearTimeout(timer.current); composingRef.current = true; setComposing(true); }} onCompositionEnd={() => { composingRef.current = false; setComposing(false); }} onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || composingRef.current)) event.preventDefault(); }} placeholder={guest ? 'Tên món hoặc hương vị bạn muốn tìm…' : 'Nhập một phần tên…'} aria-describedby={guest ? id + '-hint' : undefined} />
          {draft.q && <button type="button" className="query-clear" aria-label="Xóa từ khóa" onClick={() => { field('q', '', true); searchRef.current?.focus(); }}><X aria-hidden="true" /></button>}
        </div>
      </div>
      <label className="query-sort"><span>Sắp xếp</span><select aria-label="Sắp xếp" name="sort" value={ranked ? 'relevance' : draft.sort} disabled={ranked} aria-describedby={ranked ? id + '-rank' : undefined} onChange={event => field('sort', event.target.value, true)}>
        {ranked && <option value="relevance">Độ phù hợp</option>}<option value="">Thứ tự ban đầu</option><option value="name-asc">Tên A-Z</option><option value="name-desc">Tên Z-A</option>{resource === 'dishes' && <><option value="price-asc">Giá tăng dần</option><option value="price-desc">Giá giảm dần</option></>}
      </select></label>
      <button type="submit" className="button query-submit"><Search aria-hidden="true" /> Tìm kiếm</button>
    </div>
    {guest && <p className="query-hint" id={id + '-hint'}>Tìm theo tên và mô tả, có thể nhập không dấu.</p>}
    {ranked && <p className="query-hint" id={id + '-rank'}>Kết quả ưu tiên độ phù hợp với từ khóa. Xóa từ khóa để sắp xếp theo tên hoặc giá.</p>}
    {resource === 'dishes' && <details className="query-filters" open={filtersOpen} onToggle={event => setFiltersOpen(event.currentTarget.open)}>
      <summary><span><SlidersHorizontal aria-hidden="true" /> Bộ lọc món ăn {filterCount > 0 && <span className="query-badge">{filterCount}<span className="sr-only"> điều kiện đang áp dụng</span></span>}</span><ChevronDown className="query-chevron" aria-hidden="true" /></summary>
      <div className="query-filter-fields">
        <label><span>Danh mục</span><select aria-label="Danh mục" value={draft.category} onChange={event => field('category', event.target.value, true)}><option value="">Tất cả danh mục</option>{[...new Set([...(facets.data?.categories ?? []), ...(draft.category ? [draft.category] : [])])].map(category => <option key={category}>{category}</option>)}</select></label>
        {(['minPrice', 'maxPrice'] as const).map(key => <label key={key}><span>{key === 'minPrice' ? 'Giá từ (VNĐ)' : 'Giá đến (VNĐ)'}</span><input type="text" inputMode="decimal" aria-label={key === 'minPrice' ? 'Giá từ (VNĐ)' : 'Giá đến (VNĐ)'} name={key} value={draft[key]} placeholder={key === 'minPrice' ? '0' : 'Không giới hạn'} aria-invalid={!!visibleErrors[key]} aria-describedby={visibleErrors[key] ? id + '-' + key : undefined} onChange={event => field(key, event.target.value)} />{visibleErrors[key] && <span className="field-error" id={id + '-' + key} role="alert">{visibleErrors[key]}</span>}</label>)}
        <label><span>Phục vụ</span><select aria-label="Phục vụ" value={draft.available} onChange={event => field('available', event.target.value, true)}><option value="">Tất cả trạng thái</option><option value="true">Đang phục vụ</option><option value="false">Tạm hết</option></select></label>
      </div>
      {facets.loading && <p className="query-hint" role="status">Đang tải danh mục…</p>}
      {facets.error && <p className="query-hint" role="status">Chưa tải được danh mục. <button type="button" className="text-link" onClick={facets.retry}>Thử lại</button></p>}
    </details>}
    {(filtering || dirty) && <div className="query-active"><ul aria-label="Điều kiện đang áp dụng">{activeKeys.map(key => <li key={key}><button type="button" className="query-chip" aria-label={'Bỏ ' + chipLabel(key)} onClick={event => { const next = event.currentTarget.closest('li')?.nextElementSibling?.querySelector('button') as HTMLButtonElement | null; (next ?? searchRef.current)?.focus(); remove(key); }}><span>{chipLabel(key)}</span><X aria-hidden="true" /></button></li>)}</ul><button type="button" className="query-reset" onClick={() => remove()}>Xóa tất cả</button></div>}
    <p className="query-pending" role="status">{dirty ? Object.keys(visibleErrors).length ? 'Sửa khoảng giá để cập nhật kết quả.' : composing ? 'Đang nhập từ khóa…' : 'Đang chờ cập nhật…' : ''}</p>
  </form>;
}

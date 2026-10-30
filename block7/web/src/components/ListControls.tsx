import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { api, labels, type Resource } from '../api';
import { useLoad } from '../hooks/useLoad';

const keys = ['q', 'category', 'minPrice', 'maxPrice', 'available', 'sort'] as const;
export function ListControls({ resource, guest = false }: { resource: Resource; guest?: boolean }) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const serialized = params.toString();
  const read = () => Object.fromEntries(keys.map(k => [k, params.get(k) ?? ''])) as Record<typeof keys[number], string>;
  const [draft, setDraft] = useState(read);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(() => matchMedia('(min-width: 768px)').matches);
  useEffect(() => { setDraft(read()); setError(''); }, [serialized]);
  const facets = useLoad(resource, signal => resource === 'dishes' ? api<{ categories: string[] }>('/dishes/facets', { signal }) : Promise.resolve({ categories: [] }));
  const field = (key: typeof keys[number], value: string) => setDraft(old => ({ ...old, [key]: value }));
  const filtering = keys.some(k => params.has(k));
  return <form className="query-controls" role="search" onSubmit={event => {
    event.preventDefault();
    if (draft.minPrice && draft.maxPrice && Number(draft.minPrice) > Number(draft.maxPrice)) { setError('Giá tối thiểu phải nhỏ hơn hoặc bằng giá tối đa.'); return; }
    const next = new URLSearchParams();
    for (const key of keys) if (draft[key].trim()) next.set(key, draft[key].trim());
    setError(''); setParams(next, { state: location.state });
  }}>
    <div className="query-main"><label className="query-search"><span>{guest ? 'Tìm món' : 'Tìm ' + labels[resource]}</span><input type="search" name="q" maxLength={200} value={draft.q} onChange={e => field('q', e.target.value)} placeholder={guest ? 'Tên món hoặc hương vị bạn muốn tìm…' : 'Nhập một phần tên…'} /></label>
      <label><span>Sắp xếp</span>{guest && draft.q.trim() ? <select disabled aria-label="Sắp xếp"><option>Độ phù hợp</option></select> : <select aria-label="Sắp xếp" name="sort" value={draft.sort} onChange={e => field('sort', e.target.value)}><option value="">Thứ tự ban đầu</option><option value="name-asc">Tên A–Z</option><option value="name-desc">Tên Z–A</option>{resource === 'dishes' && <><option value="price-asc">Giá tăng dần</option><option value="price-desc">Giá giảm dần</option></>}</select>}</label>
      <button type="submit" className="button"><Search aria-hidden="true" /> Áp dụng</button>{filtering && <button type="button" className="button secondary" onClick={() => setParams({}, { state: location.state })}><X aria-hidden="true" /> Xóa điều kiện</button>}
    </div>
    {resource === 'dishes' && <details className="query-filters" open={filtersOpen} onToggle={event => setFiltersOpen(event.currentTarget.open)}><summary>Bộ lọc món ăn{params.has('category') || params.has('minPrice') || params.has('maxPrice') || params.has('available') ? ' · Đang áp dụng' : ''}</summary><div className="query-filter-fields">
      <label><span>Danh mục</span><select aria-label="Danh mục" value={draft.category} onChange={e => field('category', e.target.value)}><option value="">Tất cả danh mục</option>{[...new Set([...(facets.data?.categories ?? []), ...(draft.category ? [draft.category] : [])])].map(c => <option key={c}>{c}</option>)}</select></label>
      <label><span>Giá từ (VNĐ)</span><input type="number" min="0" max="9999999999.99" step="0.01" value={draft.minPrice} onChange={e => field('minPrice', e.target.value)} /></label>
      <label><span>Giá đến (VNĐ)</span><input type="number" min="0" max="9999999999.99" step="0.01" value={draft.maxPrice} onChange={e => field('maxPrice', e.target.value)} /></label>
      <label><span>Phục vụ</span><select aria-label="Phục vụ" value={draft.available} onChange={e => field('available', e.target.value)}><option value="">Tất cả trạng thái</option><option value="true">Đang phục vụ</option><option value="false">Tạm hết</option></select></label>
    </div>{facets.error && <p role="status">Chưa tải được danh mục. <button type="button" className="text-link" onClick={facets.retry}>Thử lại</button></p>}</details>}
    {guest && <p className="field-hint">Tìm theo tên và mô tả, có thể nhập không dấu. Nếu chưa có kết quả, chúng tôi sẽ gợi ý tên gần giống.</p>}
    {error && <p className="field-error" role="alert">{error}</p>}
  </form>;
}

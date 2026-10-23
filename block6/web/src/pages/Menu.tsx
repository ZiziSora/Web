import { useEffect,useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api,type Entity } from '../api';
import { State } from '../components/State';
import { DishGrid } from '../components/dishes/DishGrid';
import { useLoad } from '../hooks/useLoad';

export function Menu() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]);
  const s = useLoad(q, signal => api<Entity[]>('/dishes?q=' + encodeURIComponent(q), { signal }));
  return <><section className="menu-hero container"><div className="hero-copy"><p className="eyebrow">MỜI BẠN NGỒI XUỐNG</p><h1>Vị quen thuộc.<br /><em>Chút bất ngờ.</em></h1><p className="hero-description">Từ căn bếp Việt đến những hương vị phương xa.<br />Một thực đơn để khám phá, một chiếc bàn để sẻ chia.</p><a href="#menu" className="text-link">Khám phá thực đơn <span aria-hidden="true">↓</span></a></div><div className="hero-art"><img className="table-illustration" src="/table-setting.svg" width="520" height="500" alt="Bàn ăn The Table" /></div></section>
    <section className="menu-section container" id="menu"><div className="section-heading"><div><h2>Thực đơn của chúng tôi<span className="accent">.</span></h2><p className="muted">Chọn một món ngon, tìm một hương vị mới.</p></div></div>
      <div className="menu-toolbar"><p className="result-count" aria-live="polite">{s.data ? <><span>{s.data.length}</span> {q ? 'món phù hợp' : 'món dành cho bạn'}</> : s.loading ? 'Đang tải thực đơn…' : 'Thực đơn chưa sẵn sàng'}</p><form className="search-form" role="search" onSubmit={e => { e.preventDefault(); setParams(search.trim() ? { q: search.trim() } : {}); }}><label className="sr-only" htmlFor="q">Tìm món theo tên</label><input id="q" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Bạn đang muốn ăn gì?" /><button>Tìm món <span aria-hidden="true">↗</span></button></form></div>
      {q && <div className="search-summary"><p>Kết quả cho “{q}”</p><button onClick={() => setParams({})}>Xóa tìm kiếm</button></div>}
      {s.loading || s.error ? <State {...s} /> : s.data?.length ? <DishGrid dishes={s.data} /> : <div className="empty-state"><h3>{q ? 'Chưa tìm thấy món bạn muốn.' : 'Thực đơn đang được chuẩn bị.'}</h3><p>{q ? 'Thử một tên món ngắn hơn hoặc khám phá lại toàn bộ thực đơn.' : 'Mời bạn quay lại sau để khám phá những món ngon mới.'}</p>{q && <button className="button secondary" onClick={() => setParams({})}>Xem tất cả món</button>}</div>}
    </section></>;
}

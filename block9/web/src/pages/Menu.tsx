import { useRef } from 'react';
import { ArrowDown, Utensils } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { HeroTableIllustration } from '../components/HeroTableIllustration';
import { MenuBook } from '../components/dishes/MenuBook';
import { ListControls } from '../components/ListControls';
import { State } from '../components/State';
import { MenuLoading } from '../components/dishes/MenuLoading';
import { usePagedList } from '../hooks/usePagedList';

export function Menu() {
  const [params, setParams] = useSearchParams();
  const s = usePagedList('dishes', true);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const q = params.get('q') ?? '';
  const data = s.data;
  return <><section className="menu-hero container"><div className="hero-copy"><p className="eyebrow">MỜI BẠN NGỒI XUỐNG</p><h1>Vị quen thuộc.<br /><em>Chút bất ngờ.</em></h1><p className="hero-description">Từ căn bếp Việt đến những hương vị phương xa.<br />Một thực đơn để khám phá, một chiếc bàn để sẻ chia.</p><a href="#menu" className="text-link">Khám phá thực đơn <ArrowDown aria-hidden="true" focusable="false" /></a></div><div className="hero-art"><HeroTableIllustration /></div></section>
    <section className="menu-section container" id="menu"><div className="section-heading"><div><h2 ref={headingRef} tabIndex={-1}>Thực đơn của chúng tôi<span className="accent">.</span></h2><p className="muted">Chọn một món ngon, tìm một hương vị mới.</p></div></div>
      <ListControls resource="dishes" guest />
      <p className="result-count" aria-live="polite">{data ? <><span>{data.meta.total}</span> món{q ? ' phù hợp' : ' dành cho bạn'}{s.loading && ' · Đang tải trang…'}</> : 'Đang tải thực đơn…'}</p>
      {q && data && <div className="search-summary"><p>{data.meta.effectiveMode === 'fuzzy' ? 'Các món có tên gần giống' : 'Kết quả'} cho “{q}”{data.meta.effectiveMode === 'fuzzy' && ' · Không có kết quả khớp tên và mô tả.'}</p></div>}
      {!data ? s.loading ? <MenuLoading /> : <State {...s} /> : <>{s.error && <div className="notice error" role="alert">{s.error.message} <button className="button secondary" onClick={s.retry}>Thử lại</button></div>}{data.items.length ? <MenuBook key={s.signature} dishes={data.items} page={data.meta.page} pages={data.meta.pages} total={data.meta.total} headingRef={headingRef} onRetry={s.retry} loading={s.loading} /> : <div className="empty-state"><h3>Chưa có món phù hợp.</h3><p>Thử từ khóa khác hoặc điều chỉnh bộ lọc.</p><button className="button secondary" onClick={() => setParams({})}><Utensils aria-hidden="true" /> Xem tất cả món</button></div>}</>}
    </section></>;
}

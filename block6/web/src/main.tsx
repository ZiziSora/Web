import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, NavLink, Navigate, useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { api, ApiError, labels, money, type Entity, type Resource } from './api';
import './styles.css';

// Associate results with their request so a new URL never renders the previous record.
function useLoad<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [state, set] = useState<{ key: string; data?: T; error?: ApiError; loading: boolean }>({ key, loading: true });
  const [attempt, bump] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    set({ key, loading: true });
    load(controller.signal).then(data => {
      if (!controller.signal.aborted) set({ key, data, loading: false });
    }).catch(error => {
      if (!controller.signal.aborted) set({ key, error: error instanceof ApiError ? error : new ApiError('Vui lòng thử lại sau.'), loading: false });
    });
    return () => controller.abort();
  }, [key, attempt]);
  return { ...(state.key === key ? state : { key, data: undefined, error: undefined, loading: true }), retry: () => bump(x => x + 1) };
}

function State({ loading, error, retry }: { loading: boolean; error?: ApiError; retry: () => void }) {
  const { pathname } = useLocation();
  const admin = pathname.startsWith('/admin/');
  const resource = pathname.split('/')[admin ? 2 : 1] as Resource;
  const label = labels[resource];
  const missing = error?.code === 'NOT_FOUND';
  const back = admin && label ? '/admin/' + resource : '/dishes';
  const backLabel = admin && label ? 'Về danh sách ' + label : 'Về thực đơn';
  return <section className={'status-panel ' + (loading ? 'is-loading' : '')} role={error ? 'alert' : 'status'} aria-busy={loading}>
    <div className="status-art" aria-hidden="true">{loading ? <span className="loading-ring" /> : <span className="status-code">{missing ? '404' : '!'}</span>}</div>
    <div className="status-copy"><p className="eyebrow">THE TABLE</p>
      <h1>{loading ? 'Đang chuẩn bị thông tin…' : missing ? label ? 'Không tìm thấy ' + label : 'Trang này không còn ở đây.' : 'Chưa thể tải thông tin.'}</h1>
      <p>{loading ? 'Chờ một chút, thông tin sẽ sẵn sàng ngay.' : missing ? label ? 'Thông tin bạn tìm có thể đã được xóa hoặc đường dẫn chưa đúng. Hãy quay lại danh sách để chọn nội dung hiện có.' : 'Đường dẫn có thể chưa đúng. Hãy trở về thực đơn để tiếp tục khám phá.' : error?.message}</p>
      {!loading && <div className="status-actions">{!missing && <button className="button" onClick={retry}>Thử lại</button>}<Link className={'button ' + (!missing ? 'secondary' : '')} to={back}>{backLabel} <span aria-hidden="true">↗</span></Link></div>}
    </div>
  </section>;
}

function RecordPage({ resource, mode }: { resource: Resource; mode: 'edit' | 'delete' }) {
  const { id } = useParams();
  return mode === 'edit' ? <Editor key={resource + id} resource={resource} /> : <Delete key={resource + id} resource={resource} />;
}

function Layout() {
  const loc = useLocation();
  const admin = loc.pathname.startsWith('/admin');
  useEffect(() => {
    document.body.className = admin ? 'admin-page' : 'guest-page';
    const resource = loc.pathname.split('/')[admin ? 2 : 1] as Resource;
    document.title = 'The Table · ' + (admin ? 'Quản lý ' + (labels[resource] ?? 'nhà hàng') : 'Thực đơn');
  }, [loc.pathname, admin]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [loc.pathname]);
  return <><a className="skip-link" href="#main">Đến nội dung chính</a>
    <header className="site-header"><Link to="/dishes" className="wordmark"><span>THE TABLE<small>ẨM THỰC & SẺ CHIA</small></span></Link><span className="header-note">GÓI GHÉM NHỮNG ĐIỀU NGON</span><nav className="main-nav" aria-label="Điều hướng chính"><NavLink to="/dishes">Thực đơn</NavLink><Link to="/admin" className="admin-link" aria-current={admin ? 'page' : undefined}>Quản trị <span aria-hidden="true">↗</span></Link></nav></header>
    {admin && <div className="admin-topbar"><div className="container admin-topbar-inner"><span className="eyebrow">THE TABLE / QUẢN TRỊ</span><nav className="admin-nav" aria-label="Quản lý nhà hàng">{Object.entries(labels).map(([r, l]) => <NavLink key={r} to={'/admin/' + r}>{l}</NavLink>)}</nav></div></div>}
    <main id="main"><Routes>
      <Route path="/" element={<Navigate to="/dishes" replace />} />
      <Route path="/dishes" element={<Menu />} />
      <Route path="/dishes/:id" element={<Detail />} />
      <Route path="/admin" element={<Navigate to="/admin/dishes" replace />} />
      {(Object.keys(labels) as Resource[]).map(r => <React.Fragment key={r}>
        <Route path={'/admin/' + r} element={<List key={r} resource={r} />} />
        <Route path={'/admin/' + r + '/new'} element={<Editor key={r + 'new'} resource={r} />} />
        <Route path={'/admin/' + r + '/:id/edit'} element={<RecordPage resource={r} mode="edit" />} />
        <Route path={'/admin/' + r + '/:id/delete'} element={<RecordPage resource={r} mode="delete" />} />
      </React.Fragment>)}
      <Route path="*" element={<State loading={false} error={new ApiError('Trang không tồn tại.', 'NOT_FOUND')} retry={() => {}} />} />
    </Routes></main>
    <footer className="site-footer container"><div><Link className="footer-brand" to="/dishes">THE TABLE</Link><p>Ngon hơn khi cùng nhau thưởng thức.</p></div><Link className="footer-menu-link" to="/dishes">Khám phá thực đơn <span aria-hidden="true">↗</span></Link></footer>
  </>;
}

function Menu() {
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

function DishGrid({ dishes }: { dishes: Entity[] }) {
  return <div className="dish-grid">{dishes.map((d, i) => <article className={'dish-card ' + (!d.available ? 'dish-unavailable' : '')} key={d.id}><div className="card-top"><span className="category">{d.category}</span><span className="dish-number" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span></div><h3><Link to={'/dishes/' + d.id}>{d.name}</Link></h3><p className="dish-description">{d.description}</p><div className="card-bottom"><div><span className="dish-price">{money(d.price)}</span><Availability value={d.available} /></div><Link className="circle-link" to={'/dishes/' + d.id} aria-label={'Xem chi tiết ' + d.name}>↗</Link></div></article>)}</div>;
}
function Availability({ value }: { value?: boolean }) {
  return <span className={'availability ' + (!value ? 'unavailable' : '')}><i aria-hidden="true" />{value ? 'Sẵn sàng phục vụ' : 'Tạm hết món'}</span>;
}
function Detail() {
  const { id } = useParams();
  const s = useLoad(id!, signal => api<Entity>('/dishes/' + id, { signal }));
  useEffect(() => { if (s.data) document.title = s.data.name + ' · The Table'; }, [s.data]);
  if (!s.data) return <State {...s} />;
  const d = s.data;
  return <div className="container detail-page"><Link className="back-link" to="/dishes">← Trở lại thực đơn</Link><div className="detail-layout"><section className="detail-main"><p className="eyebrow">{d.category} / THE TABLE KITCHEN</p><h1>{d.name}<span className="accent">.</span></h1><p className="detail-description">{d.description}</p><div className="detail-price-row"><span className="detail-price">{money(d.price)}</span><Availability value={d.available} /></div><p className="detail-note">Một món ngon, một khoảnh khắc quây quần.</p></section><aside className="detail-aside"><section><h2>Nguyên liệu</h2><ul className="ingredient-list">{d.ingredients?.map(i => <li key={i.id}><span>{i.name}</span><span>{i.unit}</span></li>)}</ul>{!d.ingredients?.length && <p>Danh sách nguyên liệu đang được cập nhật.</p>}</section><section><h2>Đầu bếp biết nấu món này</h2><ul className="chef-list">{d.chefs?.map(c => <li key={c.id}><div><strong>{c.name}</strong><p>{c.specialty}</p></div></li>)}</ul>{!d.chefs?.length && <p>Thông tin đầu bếp đang được cập nhật.</p>}</section></aside></div></div>;
}

const intros: Record<Resource, string> = { dishes: 'Chăm chút từng hương vị trong thực đơn.', chefs: 'Những người giữ lửa cho căn bếp.', ingredients: 'Món ngon bắt đầu từ nguyên liệu tử tế.' };
const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi');
function List({ resource: r }: { resource: Resource }) {
  const s = useLoad(r, signal => api<Entity[]>('/' + r, { signal }));
  const [query, setQuery] = useState('');
  const loc = useLocation();
  const rows = s.data?.filter(d => normalizeSearch(d.name).includes(normalizeSearch(query.trim())));
  return <section className="container admin-content"><div className="section-heading"><div><h1>Quản lý {labels[r]}<span className="accent">.</span></h1><p className="muted">{intros[r]}</p></div><Link className="button" to={'/admin/' + r + '/new'}>+ Thêm {labels[r]}</Link></div>
    {loc.state?.message && <div className="notice success" role="status">{loc.state.message}</div>}
    {!s.data ? <State {...s} /> : <><div className="list-toolbar"><p className="result-count" aria-live="polite"><span>{rows?.length}</span> {labels[r]}</p><label className="list-search"><span className="sr-only">Tìm {labels[r]}</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={'Tìm ' + labels[r] + ' theo tên…'} /></label></div>
      {!rows?.length ? <div className="empty-state"><h2>{query ? 'Chưa có kết quả phù hợp.' : 'Chưa có ' + labels[r] + '.'}</h2><p>{query ? 'Thử một tên khác hoặc xóa bộ lọc để xem tất cả.' : 'Thêm thông tin đầu tiên để bắt đầu quản lý.'}</p>{query ? <button className="button secondary" onClick={() => setQuery('')}>Xóa bộ lọc</button> : <Link className="button" to={'/admin/' + r + '/new'}>Thêm {labels[r]}</Link>}</div> : <div className="table-panel"><div className="table-caption">Danh sách {labels[r]}<span className="count-pill">{rows.length} / {s.data.length}</span></div><div className="table-scroll"><table className="resource-table"><thead><tr><th scope="col">Tên {labels[r]}</th><th scope="col">Thông tin</th><th scope="col">Liên quan</th><th scope="col" className="actions-heading">Thao tác</th></tr></thead><tbody>{rows.map(d => <tr key={d.id}><th scope="row">{r === 'dishes' ? <Link className="entity-name" to={'/dishes/' + d.id}>{d.name}</Link> : <span className="entity-name">{d.name}</span>}<span className="record-id">#{d.id}</span></th><td data-label="Thông tin">{r === 'dishes' ? <div className="dish-info"><span className="category">{d.category}</span><span className="price-cell">{money(d.price)}</span><Availability value={d.available} /></div> : r === 'chefs' ? d.specialty : d.unit}</td><td data-label="Liên quan"><div className="related-links">{r === 'dishes' ? <span>{d.chefs?.length ?? 0} đầu bếp · {d.ingredients?.length ?? 0} nguyên liệu</span> : d.dishes?.length ? d.dishes.map(x => <Link key={x.id} to={'/admin/dishes/' + x.id + '/edit'}>{x.name}</Link>) : <span className="muted">Chưa liên kết món nào</span>}</div></td><td data-label="Thao tác"><div className="row-actions"><Link to={'/admin/' + r + '/' + d.id + '/edit'} aria-label={'Sửa ' + d.name}>Sửa <span aria-hidden="true">↗</span></Link><Link className="danger-link" to={'/admin/' + r + '/' + d.id + '/delete'} aria-label={'Xóa ' + d.name}>Xóa</Link></div></td></tr>)}</tbody></table></div></div>}
    </>}
  </section>;
}

type Values = Record<string, string | number[]>;
function Editor({ resource: r }: { resource: Resource }) {
  const { id } = useParams();
  const s = useLoad(r + id, async signal => {
    const [entity, chefs, ingredients] = await Promise.all([id ? api<Entity>('/' + r + '/' + id, { signal }) : Promise.resolve(undefined), r === 'dishes' ? api<Entity[]>('/chefs', { signal }) : Promise.resolve([]), r === 'dishes' ? api<Entity[]>('/ingredients', { signal }) : Promise.resolve([])]);
    return { entity, chefs, ingredients };
  });
  if (!s.data) return <State {...s} />;
  return <section className="container admin-content form-page"><Link className="back-link" to={'/admin/' + r}>← Danh sách {labels[r]}</Link><div className="section-heading"><div><h1>{id ? 'Chỉnh sửa' : 'Thêm'} {labels[r]}<span className="accent">.</span></h1><p className="muted">{id ? 'Cập nhật thông tin và lưu khi bạn đã sẵn sàng.' : 'Điền các mục bắt buộc để thêm vào căn bếp.'}</p></div></div><Form key={r + id} resource={r} {...s.data} /></section>;
}
function Form({ resource: r, entity, chefs, ingredients }: { resource: Resource; entity?: Entity; chefs: Entity[]; ingredients: Entity[] }) {
  const navigate = useNavigate();
  const [values, set] = useState<Values>({ name: entity?.name ?? '', description: entity?.description ?? '', price: entity?.price ?? '', category: entity?.category ?? '', available: String(entity?.available ?? true), specialty: entity?.specialty ?? '', unit: entity?.unit ?? '', chefIds: entity?.chefs?.map(c => c.id) ?? [], ingredientIds: entity?.ingredients?.map(c => c.id) ?? [] });
  const [error, setError] = useState<ApiError>();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (error) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]')?.focus(); }, [error]);
  const fields = r === 'dishes' ? ['name', 'description', 'price', 'category', 'available'] : r === 'chefs' ? ['name', 'specialty'] : ['name', 'unit'];
  const titles: Record<string, string> = { name: 'Tên ' + labels[r], description: 'Mô tả món ăn', price: 'Giá (VNĐ)', category: 'Danh mục', available: 'Trạng thái phục vụ', specialty: 'Chuyên môn', unit: 'Đơn vị tính' };
  const placeholders: Record<string, string> = { name: 'Nhập tên ' + labels[r], description: 'Hương vị, cách chế biến và điều làm nên món ăn…', price: 'Ví dụ: 125000', category: 'Ví dụ: Hương vị Việt', specialty: 'Ví dụ: Ẩm thực Việt & món nướng', unit: 'Ví dụ: kg, gram, quả' };
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(undefined);
    try {
      const body = Object.fromEntries(fields.map(k => [k, k === 'available' ? values[k] === 'true' : values[k]]));
      if (r === 'dishes') Object.assign(body, { chefIds: values.chefIds, ingredientIds: values.ingredientIds });
      await api('/' + r + (entity ? '/' + entity.id : ''), { method: entity ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      navigate('/admin/' + r, { state: { message: 'Đã lưu ' + labels[r] + ' thành công.' } });
    } catch (e) { setError(e as ApiError); }
    finally { lock.current = false; setBusy(false); }
  }
  return <form ref={formRef} className="edit-form" onSubmit={submit} noValidate aria-busy={busy}>
    {error && <div className="notice error" role="alert" tabIndex={-1}>{error.fields.form ?? error.message} Thông tin bạn đã nhập vẫn được giữ lại.{error.code === 'NOT_FOUND' && <p><Link to={'/admin/' + r}>Về danh sách {labels[r]}</Link></p>}</div>}
    <fieldset className="form-controls" disabled={busy}><legend className="sr-only">Thông tin {labels[r]}</legend><div className={'form-layout ' + (r !== 'dishes' ? 'compact-form' : '')}><div className="form-panel"><div className="panel-heading"><p>Thông tin cơ bản <span className="muted">· Dấu * là bắt buộc</span></p></div>
      {fields.map(k => <div className="field" key={k}><label htmlFor={k}>{titles[k]} <span className="required">*</span></label>{k === 'available' ? <select id={k} name={k} value={String(values[k])} onChange={e => set({ ...values, [k]: e.target.value })}><option value="true">Sẵn sàng phục vụ</option><option value="false">Tạm hết món</option></select> : k === 'description' ? <textarea id={k} name={k} required maxLength={2000} rows={5} placeholder={placeholders[k]} value={String(values[k])} aria-invalid={!!error?.fields[k]} aria-describedby={error?.fields[k] ? k + '-error' : undefined} onChange={e => set({ ...values, [k]: e.target.value })} /> : <input id={k} name={k} required maxLength={k === 'name' ? 120 : k === 'unit' ? 40 : k === 'category' ? 80 : k === 'specialty' ? 200 : 13} placeholder={placeholders[k]} value={String(values[k])} inputMode={k === 'price' ? 'decimal' : undefined} aria-invalid={!!error?.fields[k]} aria-describedby={error?.fields[k] ? k + '-error' : undefined} onChange={e => set({ ...values, [k]: e.target.value })} />}{error?.fields[k] && <p className="field-error" id={k + '-error'}>{error.fields[k]}</p>}</div>)}
    </div>{r === 'dishes' && <div className="form-panel relation-panel">{[{ key: 'chefIds', title: 'Đầu bếp biết nấu món này', items: chefs, resource: 'chefs' }, { key: 'ingredientIds', title: 'Nguyên liệu của món', items: ingredients, resource: 'ingredients' }].map(g => <fieldset className="relation-fieldset" key={g.key} aria-invalid={!!error?.fields[g.key]} aria-describedby={error?.fields[g.key] ? g.key + '-error' : undefined} tabIndex={error?.fields[g.key] ? -1 : undefined}><legend>{g.title}</legend><p className="field-hint">Đã chọn {(values[g.key] as number[]).length} · Có thể chọn nhiều hoặc để trống.</p><div className="checkbox-list">{g.items.map(x => <label className="checkbox-option" key={x.id}><input type="checkbox" checked={(values[g.key] as number[]).includes(x.id)} onChange={e => set({ ...values, [g.key]: e.target.checked ? [...values[g.key] as number[], x.id] : (values[g.key] as number[]).filter(id => id !== x.id) })} /><span>{x.name}{x.unit && <small>{x.unit}</small>}</span></label>)}{!g.items.length && <p className="field-hint">Chưa có dữ liệu. Bạn có thể để trống và bổ sung sau trong mục quản lý {labels[g.resource as Resource]}.</p>}</div>{error?.fields[g.key] && <p className="field-error" id={g.key + '-error'}>{error.fields[g.key]}</p>}</fieldset>)}</div>}</div>
    <div className="form-actions"><Link className="button secondary" to={'/admin/' + r}>Hủy bỏ</Link><button type="submit" className="button" disabled={busy || error?.code === 'NOT_FOUND'}>{busy ? 'Đang lưu…' : entity ? 'Lưu thay đổi' : 'Thêm ' + labels[r]}</button></div></fieldset>
  </form>;
}

function Delete({ resource: r }: { resource: Resource }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const s = useLoad(r + id, signal => api<Entity>('/' + r + '/' + id, { signal }));
  const [error, setError] = useState<ApiError>();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const dishes = error?.dishes.length ? error.dishes : s.data?.dishes ?? [];
  const blocked = r === 'ingredients' && dishes.length > 0;
  async function remove() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(undefined);
    try {
      await api('/' + r + '/' + id, { method: 'DELETE' });
      navigate('/admin/' + r, { state: { message: 'Đã xóa ' + labels[r] + ' thành công.' } });
    } catch (e) { setError(e as ApiError); }
    finally { lock.current = false; setBusy(false); }
  }
  if (!s.data || error?.code === 'NOT_FOUND') return <State loading={s.loading} error={error ?? s.error} retry={s.retry} />;
  return <section className="container confirmation-page"><Link className="back-link" to={'/admin/' + r}>← Danh sách {labels[r]}</Link><div className="confirmation-panel"><p className="eyebrow">KIỂM TRA TRƯỚC KHI TIẾP TỤC</p><h1>{blocked ? 'Chưa thể xóa nguyên liệu' : 'Xóa ' + labels[r] + '?'}</h1><p className="confirmation-name">{s.data.name}</p>{error && <div className="notice error" role="alert">{error.message}</div>}{blocked ? <><p>Nguyên liệu này đang được dùng trong {dishes.length} món. Hãy chỉnh sửa các món dưới đây để gỡ nguyên liệu trước khi xóa.</p><ul className="blocking-dishes">{dishes.map(d => <li key={d.id}><span>{d.name}</span><Link to={'/admin/dishes/' + d.id + '/edit'}>Chỉnh sửa món ↗</Link></li>)}</ul></> : <p>Thao tác này không thể hoàn tác. {r === 'dishes' ? 'Các đầu bếp và nguyên liệu vẫn được giữ lại.' : r === 'chefs' ? 'Các món ăn vẫn được giữ lại.' : 'Nguyên liệu sẽ được xóa khỏi danh mục.'}</p>}<div className="confirmation-actions"><Link className="button secondary" to={'/admin/' + r}>Giữ lại</Link>{!blocked && <button className="button danger" disabled={busy} onClick={remove}>{busy ? 'Đang xóa…' : 'Xác nhận xóa'}</button>}</div></div></section>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><Layout /></BrowserRouter>);

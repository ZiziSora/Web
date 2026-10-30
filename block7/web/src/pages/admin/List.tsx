import { useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { labels, type Resource } from '../../api';
import { Pagination } from '../../components/Pagination';
import { ListControls } from '../../components/ListControls';
import { State } from '../../components/State';
import { ListPlaceholder } from '../../components/ListPlaceholder';
import { ResourceTable } from '../../components/admin/ResourceTable';
import { intros } from '../../config/resources';
import { usePagedList } from '../../hooks/usePagedList';
import { useClientPagedList } from '../../hooks/useClientPagedList';

export function List({ resource }: { resource: Resource }) {
  return resource === 'dishes' ? <DishList /> : <ClientList resource={resource} />;
}
function DishList() {
  const s = usePagedList('dishes');
  return <ListContent resource="dishes" s={s} />;
}
function ClientList({ resource }: { resource: 'chefs' | 'ingredients' }) {
  const s = useClientPagedList(resource);
  return <ListContent resource={resource} s={s} />;
}
function ListContent({ resource: r, s }: { resource: Resource; s: ReturnType<typeof usePagedList> }) {
  const loc = useLocation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previous = useRef<{ page: number; signature: string } | undefined>(undefined);
  const page = s.data?.meta.page;
  useEffect(() => {
    if (page && previous.current?.signature === s.signature && previous.current.page !== page) {
      headingRef.current?.focus({ preventScroll: true });
      headingRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
    if (page) previous.current = { page, signature: s.signature };
  }, [page, s.signature]);
  const data = s.data;
  return <section className="container admin-content"><div className="section-heading"><div><h1 ref={headingRef} tabIndex={-1}>Quản lý {labels[r]}<span className="accent">.</span></h1><p className="muted">{intros[r]}</p></div><Link className="button" to={'/admin/' + r + '/new'}><Plus aria-hidden="true" /> Thêm {labels[r]}</Link></div>
    {loc.state?.message && <div className="notice success" role="status">{loc.state.message}</div>}
    <ListControls resource={r} />
    {s.loading ? <ListPlaceholder /> : !data ? <State {...s} /> : <><p className="result-count" aria-live="polite"><span>{data.meta.total}</span> {labels[r]}</p>
      {s.error && <div className="notice error" role="alert">{s.error.message} <button className="button secondary" onClick={s.retry}>Thử lại</button></div>}
      {!data.items.length ? <div className="empty-state"><h2>Chưa có kết quả phù hợp.</h2><p>Thử một tên khác hoặc xóa điều kiện để xem tất cả.</p></div> : <div aria-busy={s.loading}><ResourceTable resource={r} rows={data.items} total={data.meta.total} /><Pagination page={data.meta.page} pages={data.meta.pages} total={data.meta.total} loading={s.loading} /></div>}
    </>}
  </section>;
}

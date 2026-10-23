import { Pagination } from '../../components/Pagination';
import { PAGE_SIZE, usePagination } from '../../hooks/usePagination';
import { Link,useLocation,useSearchParams } from 'react-router-dom';
import { api,labels,type Entity,type Resource } from '../../api';
import { State } from '../../components/State';
import { ResourceTable } from '../../components/admin/ResourceTable';
import { intros } from '../../config/resources';
import { useLoad } from '../../hooks/useLoad';
import { normalizeSearch } from '../../utils/search';

export function List({ resource: r }: { resource: Resource }) {
  const s = useLoad(r, signal => api<Entity[]>('/' + r, { signal }));
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const setQuery = (q: string) => {
    const next = new URLSearchParams(params);
    next.delete('page');
    if (q) next.set('q', q); else next.delete('q');
    setParams(next, { state: loc.state });
  };
  const loc = useLocation();
  const rows = s.data?.filter(d => normalizeSearch(d.name).includes(normalizeSearch(query.trim())));
  const paging = usePagination(rows?.length);
  return <section className="container admin-content"><div className="section-heading"><div><h1 ref={paging.headingRef} tabIndex={-1}>Quản lý {labels[r]}<span className="accent">.</span></h1><p className="muted">{intros[r]}</p></div><Link className="button" to={'/admin/' + r + '/new'}>+ Thêm {labels[r]}</Link></div>
    {loc.state?.message && <div className="notice success" role="status">{loc.state.message}</div>}
    {!s.data ? <State {...s} /> : <><div className="list-toolbar"><p className="result-count" aria-live="polite"><span>{rows?.length}</span> {labels[r]}</p><label className="list-search"><span className="sr-only">Tìm {labels[r]}</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={'Tìm ' + labels[r] + ' theo tên…'} /></label></div>
      {!rows?.length ? <div className="empty-state"><h2>{query ? 'Chưa có kết quả phù hợp.' : 'Chưa có ' + labels[r] + '.'}</h2><p>{query ? 'Thử một tên khác hoặc xóa bộ lọc để xem tất cả.' : 'Thêm thông tin đầu tiên để bắt đầu quản lý.'}</p>{query ? <button className="button secondary" onClick={() => setQuery('')}>Xóa bộ lọc</button> : <Link className="button" to={'/admin/' + r + '/new'}>Thêm {labels[r]}</Link>}</div> : <><ResourceTable resource={r} rows={rows.slice(paging.start, paging.start + PAGE_SIZE)} total={rows.length} /><Pagination page={paging.page} pages={paging.pages} total={rows.length} /></>}
    </>}
  </section>;
}

import { useState } from 'react';
import { Link,useLocation } from 'react-router-dom';
import { api,labels,type Entity,type Resource } from '../../api';
import { State } from '../../components/State';
import { ResourceTable } from '../../components/admin/ResourceTable';
import { intros } from '../../config/resources';
import { useLoad } from '../../hooks/useLoad';
import { normalizeSearch } from '../../utils/search';

export function List({ resource: r }: { resource: Resource }) {
  const s = useLoad(r, signal => api<Entity[]>('/' + r, { signal }));
  const [query, setQuery] = useState('');
  const loc = useLocation();
  const rows = s.data?.filter(d => normalizeSearch(d.name).includes(normalizeSearch(query.trim())));
  return <section className="container admin-content"><div className="section-heading"><div><h1>Quản lý {labels[r]}<span className="accent">.</span></h1><p className="muted">{intros[r]}</p></div><Link className="button" to={'/admin/' + r + '/new'}>+ Thêm {labels[r]}</Link></div>
    {loc.state?.message && <div className="notice success" role="status">{loc.state.message}</div>}
    {!s.data ? <State {...s} /> : <><div className="list-toolbar"><p className="result-count" aria-live="polite"><span>{rows?.length}</span> {labels[r]}</p><label className="list-search"><span className="sr-only">Tìm {labels[r]}</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={'Tìm ' + labels[r] + ' theo tên…'} /></label></div>
      {!rows?.length ? <div className="empty-state"><h2>{query ? 'Chưa có kết quả phù hợp.' : 'Chưa có ' + labels[r] + '.'}</h2><p>{query ? 'Thử một tên khác hoặc xóa bộ lọc để xem tất cả.' : 'Thêm thông tin đầu tiên để bắt đầu quản lý.'}</p>{query ? <button className="button secondary" onClick={() => setQuery('')}>Xóa bộ lọc</button> : <Link className="button" to={'/admin/' + r + '/new'}>Thêm {labels[r]}</Link>}</div> : <ResourceTable resource={r} rows={rows} total={s.data.length} />}
    </>}
  </section>;
}

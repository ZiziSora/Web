import { useRef,useState } from 'react';
import { Link,useNavigate,useParams } from 'react-router-dom';
import { api,ApiError,labels,type Entity,type Resource } from '../../api';
import { State } from '../../components/State';
import { useLoad } from '../../hooks/useLoad';

export function Delete({ resource: r }: { resource: Resource }) {
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

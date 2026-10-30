import { ArrowLeft } from 'lucide-react';
import { Link,useParams } from 'react-router-dom';
import { api,labels,type Entity,type Resource } from '../../api';
import { State } from '../../components/State';
import { Form } from '../../components/forms/ResourceForm';
import { useLoad } from '../../hooks/useLoad';

export function Editor({ resource: r }: { resource: Resource }) {
  const { id } = useParams();
  const s = useLoad(r + id, async signal => {
    const entity = id ? await api<Entity>('/' + r + '/' + id, { signal }) : undefined;
    return { entity, chefs: entity?.chefs ?? [], ingredients: entity?.ingredients ?? [] };
  });
  if (!s.data) return <State {...s} />;
  return <section className="container admin-content form-page"><Link className="back-link" to={'/admin/' + r}><ArrowLeft aria-hidden="true" focusable="false" /> Danh sách {labels[r]}</Link><div className="section-heading"><div><h1>{id ? 'Chỉnh sửa' : 'Thêm'} {labels[r]}<span className="accent">.</span></h1><p className="muted">{id ? 'Cập nhật thông tin và lưu khi bạn đã sẵn sàng.' : 'Điền các mục bắt buộc để thêm vào căn bếp.'}</p></div></div><Form key={r + id} resource={r} {...s.data} /></section>;
}

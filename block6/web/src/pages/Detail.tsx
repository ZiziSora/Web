import { useEffect } from 'react';
import { Link,useParams } from 'react-router-dom';
import { api,money,type Entity } from '../api';
import { State } from '../components/State';
import { Availability } from '../components/dishes/Availability';
import { useLoad } from '../hooks/useLoad';

export function Detail() {
  const { id } = useParams();
  const s = useLoad(id!, signal => api<Entity>('/dishes/' + id, { signal }));
  useEffect(() => { if (s.data) document.title = s.data.name + ' · The Table'; }, [s.data]);
  if (!s.data) return <State {...s} />;
  const d = s.data;
  return <div className="container detail-page"><Link className="back-link" to="/dishes">← Trở lại thực đơn</Link><div className="detail-layout"><section className="detail-main"><p className="eyebrow">{d.category} / THE TABLE KITCHEN</p><h1>{d.name}<span className="accent">.</span></h1><p className="detail-description">{d.description}</p><div className="detail-price-row"><span className="detail-price">{money(d.price)}</span><Availability value={d.available} /></div><p className="detail-note">Một món ngon, một khoảnh khắc quây quần.</p></section><aside className="detail-aside"><section><h2>Nguyên liệu</h2><ul className="ingredient-list">{d.ingredients?.map(i => <li key={i.id}><span>{i.name}</span><span>{i.unit}</span></li>)}</ul>{!d.ingredients?.length && <p>Danh sách nguyên liệu đang được cập nhật.</p>}</section><section><h2>Đầu bếp biết nấu món này</h2><ul className="chef-list">{d.chefs?.map(c => <li key={c.id}><div><strong>{c.name}</strong><p>{c.specialty}</p></div></li>)}</ul>{!d.chefs?.length && <p>Thông tin đầu bếp đang được cập nhật.</p>}</section></aside></div></div>;
}

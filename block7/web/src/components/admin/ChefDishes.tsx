import { ChevronDown, Search } from 'lucide-react';
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Entity } from '../../api';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

export function ChefDishes({ dishes, name }: { dishes: Entity[]; name: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const id = useId();
  if (!dishes.length) return <span className="muted">Chưa liên kết món nào</span>;
  const matches = open ? dishes.filter(dish => normalize(dish.name).includes(normalize(query.trim()))) : [];
  return <div className="chef-dishes">
    <p className="chef-dishes-count">{dishes.length} món ăn</p>
    {!open && <ul className="chef-dishes-preview">{dishes.slice(0, 2).map(dish => <li key={dish.id}><Link title={dish.name} to={'/admin/dishes/' + dish.id + '/edit'}>{dish.name}</Link></li>)}</ul>}
    {dishes.length > 2 && <button type="button" className="chef-dishes-toggle" aria-expanded={open} aria-controls={id} aria-label={(open ? 'Thu gọn món ăn của ' : 'Xem tất cả món ăn của ') + name} onClick={() => { setOpen(!open); setQuery(''); }}>{open ? 'Thu gọn danh sách' : `Xem tất cả ${dishes.length} món`}<ChevronDown aria-hidden="true" /></button>}
    {open && <div className="chef-dishes-panel" id={id}>
      <label className="chef-dishes-search"><Search aria-hidden="true" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label={'Tìm món của ' + name} placeholder="Tìm trong các món của đầu bếp…" /></label>
      <p className="chef-dishes-matches" role="status">{matches.length} / {dishes.length} món ăn</p>
      <div className="chef-dishes-scroll" tabIndex={0} role="region" aria-label={'Món ăn của ' + name}>
        {matches.length ? <ul>{matches.map(dish => <li key={dish.id}><Link to={'/admin/dishes/' + dish.id + '/edit'}>{dish.name}</Link></li>)}</ul> : <p className="muted">Không có món phù hợp. Thử tên khác.</p>}
      </div>
    </div>}
  </div>;
}

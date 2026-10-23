import { Link } from 'react-router-dom';
import { money,type Entity } from '../../api';
import { Availability } from './Availability';

export function DishGrid({ dishes, startIndex = 0 }: { dishes: Entity[]; startIndex?: number }) {
  return <div className="dish-grid">{dishes.map((d, i) => <article className={'dish-card ' + (!d.available ? 'dish-unavailable' : '')} key={d.id}><div className="card-top"><span className="category">{d.category}</span><span className="dish-number" aria-hidden="true">{String(startIndex + i + 1).padStart(2, '0')}</span></div><h3><Link to={'/dishes/' + d.id}>{d.name}</Link></h3><p className="dish-description">{d.description}</p><div className="card-bottom"><div><span className="dish-price">{money(d.price)}</span><Availability value={d.available} /></div><Link className="circle-link" to={'/dishes/' + d.id} aria-label={'Xem chi tiết ' + d.name}>↗</Link></div></article>)}</div>;
}

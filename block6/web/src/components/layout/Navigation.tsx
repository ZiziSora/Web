import { Link,NavLink } from 'react-router-dom';
import { labels } from '../../config/labels';

export function Header({admin}:{admin:boolean}) { return <header className="site-header"><Link to="/dishes" className="wordmark"><span>THE TABLE<small>ẨM THỰC & SẺ CHIA</small></span></Link><span className="header-note">GÓI GHÉM NHỮNG ĐIỀU NGON</span><nav className="main-nav" aria-label="Điều hướng chính"><NavLink to="/dishes">Thực đơn</NavLink><Link to="/admin" className="admin-link" aria-current={admin ? 'page' : undefined}>Quản trị <span aria-hidden="true">↗</span></Link></nav></header>; }

export function AdminNav() { return <div className="admin-topbar"><div className="container admin-topbar-inner"><span className="eyebrow">THE TABLE / QUẢN TRỊ</span><nav className="admin-nav" aria-label="Quản lý nhà hàng">{Object.entries(labels).map(([r, l]) => <NavLink key={r} to={'/admin/' + r}>{l}</NavLink>)}</nav></div></div>; }

export function Footer() { return <footer className="site-footer container"><div><Link className="footer-brand" to="/dishes">THE TABLE</Link><p>Ngon hơn khi cùng nhau thưởng thức.</p></div><Link className="footer-menu-link" to="/dishes">Khám phá thực đơn <span aria-hidden="true">↗</span></Link></footer>; }

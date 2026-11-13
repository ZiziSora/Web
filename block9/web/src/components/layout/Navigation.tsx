import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { logout } from '../../auth/state';
import { LayoutDashboard, Utensils } from 'lucide-react';
import { Link,NavLink } from 'react-router-dom';
import { labels } from '../../config/labels';

export function Header({admin}:{admin:boolean}) {
  const auth = useAuth(), navigate = useNavigate();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function signOut() {
    setBusy(true); setError('');
    try { await logout(); navigate('/login', { replace: true }); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <header className="site-header"><Link to="/dishes" className="wordmark"><span>THE TABLE<small>ẨM THỰC & SẺ CHIA</small></span></Link><span className="header-note">GÓI GHÉM NHỮNG ĐIỀU NGON</span><nav className="main-nav" aria-label="Điều hướng chính"><NavLink to="/dishes">Thực đơn</NavLink><Link to="/admin" className="admin-link" aria-current={admin ? 'page' : undefined}><LayoutDashboard aria-hidden="true" focusable="false" /> Quản trị</Link>{auth.user ? <><span className="account-email" title={auth.user.email}>{auth.user.email}</span><button type="button" className="logout-button" disabled={busy} onClick={() => void signOut()}>{busy ? 'Đang thoát…' : 'Đăng xuất'}</button></> : auth.status !== 'loading' && <><NavLink to="/login">Đăng nhập</NavLink><NavLink to="/register">Đăng ký</NavLink></>}{error && <span className="header-auth-error" role="alert">{error}</span>}</nav></header>; }

export function AdminNav() { return <div className="admin-topbar"><div className="container admin-topbar-inner"><span className="eyebrow">THE TABLE / QUẢN TRỊ</span><nav className="admin-nav" aria-label="Quản lý nhà hàng">{Object.entries(labels).map(([r, l]) => <NavLink key={r} to={'/admin/' + r}>{l}</NavLink>)}</nav></div></div>; }

export function Footer() { return <footer className="site-footer container"><div><Link className="footer-brand" to="/dishes">THE TABLE</Link><p>Ngon hơn khi cùng nhau thưởng thức.</p></div><Link className="footer-menu-link" to="/dishes">Khám phá thực đơn <Utensils aria-hidden="true" focusable="false" /></Link></footer>; }

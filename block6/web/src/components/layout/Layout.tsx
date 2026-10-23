import React,{ useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { labels,type Resource } from '../../api';
import { AdminNav,Footer,Header } from './Navigation';

export function Layout({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const admin = loc.pathname.startsWith('/admin');
  useEffect(() => {
    document.body.className = admin ? 'admin-page' : 'guest-page';
    const resource = loc.pathname.split('/')[admin ? 2 : 1] as Resource;
    document.title = 'The Table · ' + (admin ? 'Quản lý ' + (labels[resource] ?? 'nhà hàng') : 'Thực đơn');
  }, [loc.pathname, admin]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [loc.pathname]);
  return <><a className="skip-link" href="#main">Đến nội dung chính</a>
    <Header admin={admin} />
    {admin && <AdminNav />}
    <main id="main">{children}</main>
    <Footer />
  </>;
}

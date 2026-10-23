import { useLocation } from 'react-router-dom';

function Line({ width = '100%', tall = false }: { width?: string; tall?: boolean }) {
  return <span className={`skeleton-line${tall ? ' skeleton-line--title' : ''}`} style={{ width }} />;
}

/** Placeholders follow the current page; no data is shared between routes. */
export function Loading() {
  const { pathname } = useLocation();
  const detail = /^\/dishes\/[^/]+$/.test(pathname);
  const form = /\/(new|edit)$/.test(pathname);
  const confirmation = pathname.endsWith('/delete');
  const table = pathname.startsWith('/admin') && !form && !confirmation;
  return (
    <div className={`loading-view${detail ? ' container detail-page' : ''}`} role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Đang tải nội dung, vui lòng chờ.</span>
      <div aria-hidden="true">
        <div className="loading-caption"><span className="loading-mark"><i /><i /><i /></span><span>Đang chuẩn bị cho bạn</span></div>
        {detail ? (
          <><div className="loading-back"><Line width="150px" /></div><div className="detail-layout">
            <div className="detail-main skeleton-detail"><Line width="45%" /><Line width="80%" tall /><Line width="60%" tall /><div className="skeleton-copy"><Line /><Line width="92%" /><Line width="74%" /></div><Line width="35%" tall /></div>
            <div className="detail-aside">{[0, 1].map(i => <section key={i}><Line width="55%" tall /><div className="skeleton-copy">{[0, 1, 2].map(j => <Line key={j} width={`${90 - j * 15}%`} />)}</div></section>)}</div>
          </div></>
        ) : form ? (
          <div className="form-layout">{[0, 1].map(i => <div className="form-panel" key={i}><Line width="48%" />{[0, 1, 2].map(j => <div className="skeleton-field" key={j}><Line width="30%" /><span className="skeleton-input" /></div>)}</div>)}</div>
        ) : table ? (
          <div className="table-panel skeleton-table"><div className="skeleton-table-row skeleton-table-head"><Line width="65%" /><Line width="60%" /><Line width="45%" /></div>{[0, 1, 2, 3, 4].map(i => <div className="skeleton-table-row" key={i}><Line width={`${80 - i * 7}%`} /><Line width="65%" /><Line width="55%" /></div>)}</div>
        ) : confirmation ? (
          <div className="confirmation-panel skeleton-confirmation"><span className="skeleton-circle" /><Line width="65%" tall /><Line width="45%" /><div className="skeleton-copy"><Line /><Line width="80%" /></div><span className="skeleton-input" /></div>
        ) : (
          <div className="dish-grid">{[0, 1, 2, 3].map(i => <div className="dish-card skeleton-card" key={i}><Line width="28%" /><Line width={`${68 + (i % 2) * 15}%`} tall /><div className="skeleton-copy"><Line /><Line width="88%" /><Line width="60%" /></div><div className="skeleton-card-bottom"><Line width="35%" tall /><span className="skeleton-circle" /></div></div>)}</div>
        )}
      </div>
    </div>
  );
}

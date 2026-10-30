export function ListPlaceholder({ menu = false }: { menu?: boolean }) {
  return <div className={'loading-view list-placeholder ' + (menu ? 'list-placeholder-menu' : 'list-placeholder-table')} role="status" aria-busy="true">
    <span className="sr-only">Đang cập nhật kết quả…</span>
    <div className="list-placeholder-items" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div className="list-placeholder-item" key={index}><span className="skeleton-line" /><span className="skeleton-line" /><span className="skeleton-line" />{!menu && <span className="skeleton-line" />}</div>)}</div>
  </div>;
}

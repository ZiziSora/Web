export function BookSkeletonLeaves() {
  return <>{[0, 1].map(leaf => <div className="book-leaf" key={leaf} aria-hidden="true"><p className="book-running-title"><span className="skeleton-line" /></p>{[0, 1, 2].map(item => <div className="book-skeleton-entry" key={item}><span className="skeleton-line" /><span className="skeleton-line skeleton-line--title" /><span className="skeleton-line" /><span className="skeleton-line" /><span className="skeleton-line" /></div>)}</div>)}</>;
}

export function MenuSkeleton() {
  return <div className="loading-view menu-book menu-skeleton" role="status" aria-busy="true"><span className="sr-only">Đang tải thực đơn…</span><div className="book-binding"><div className="book-content"><BookSkeletonLeaves /></div></div></div>;
}

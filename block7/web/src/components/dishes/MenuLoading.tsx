function LoadingLeaf() {
  return <div className="book-leaf book-loading-leaf">
    <p className="book-running-title">THE TABLE · THỰC ĐƠN</p>
    <div className="book-loading-imprint"><span>THE TABLE</span><span>Thực đơn</span></div>
  </div>;
}

/** Decorative sheets turn while the request is pending; no dish data is shown. */
export function BookLoadingPages({ direction = 'forward' }: { direction?: 'forward' | 'back' }) {
  return <div className="book-loading-content" data-direction={direction} role="status" aria-live="polite">
    <span className="sr-only">Đang tải thực đơn, vui lòng chờ.</span>
    <div className="book-content" aria-hidden="true"><LoadingLeaf /><LoadingLeaf /></div>
    <div className="book-loading-sheets" key={direction} aria-hidden="true">
      {[0, 1, 2].map(index => <div className="book-loading-sheet" key={index}>
        <span className="book-loading-face" /><span className="book-loading-face book-loading-reverse" />
      </div>)}
    </div>
    <p className="book-loading-caption" aria-hidden="true">Đang tải thực đơn…</p>
  </div>;
}

export function MenuLoading() {
  return <div className="menu-book menu-loading" aria-busy="true"><div className="book-binding"><BookLoadingPages /></div></div>;
}

import { PAGE_SIZE, pageCount, pageItems } from '../pagination.js';

export default function StudentList({ students, page, onPageChange, status, error, onRetry }) {
  const total = pageCount(students.length);
  const current = Math.min(page, total);
  const start = (current - 1) * PAGE_SIZE;
  return <section className="card list-card" aria-labelledby="list-heading" aria-busy={status === 'loading'}>
    <div className="section-heading list-heading">
      <span className="section-number section-number-blue" aria-hidden="true">02</span>
      <div><p className="section-label">Dữ liệu hiện tại</p><h2 id="list-heading">Danh sách sinh viên</h2></div>
      {status === 'ready' && <span className="student-count">{students.length} sinh viên</span>}
    </div>
    {status === 'loading' ? <div className="empty-state" role="status"><p>Đang tải danh sách…</p></div>
      : status === 'error' ? <div className="empty-state"><p role="alert">{error}</p><button type="button" onClick={onRetry}>Thử lại</button></div>
      : students.length === 0 ? <div className="empty-state"><p>Chưa có sinh viên. Hãy thêm sinh viên đầu tiên.</p></div>
      : <>
        <div className="table-wrapper"><table aria-label="Danh sách sinh viên">
          <thead><tr><th scope="col">ID</th><th scope="col">Họ và tên</th><th scope="col">Email</th></tr></thead>
          <tbody>{students.slice(start, start + PAGE_SIZE).map(student => <tr key={student.id}>
            <td><span className="id-badge">{student.id}</span></td><td className="student-name">{student.name}</td><td><a href={`mailto:${student.email}`}>{student.email}</a></td>
          </tr>)}</tbody>
        </table></div>
        <div className="pagination-summary" role="status">Trang {current}/{total} · Hiển thị {start + 1}–{Math.min(start + PAGE_SIZE, students.length)} / {students.length} sinh viên</div>
        <nav className="pagination" aria-label="Phân trang danh sách sinh viên">
          <button type="button" disabled={current === 1} onClick={() => onPageChange(current - 1)}>Trước</button>
          {pageItems(current, total).map(item => typeof item === 'number'
            ? <button key={item} type="button" aria-label={`Trang ${item}`} aria-current={item === current ? 'page' : undefined} onClick={() => onPageChange(item)}>{item}</button>
            : <span key={item} aria-hidden="true">…</span>)}
          <button type="button" disabled={current === total} onClick={() => onPageChange(current + 1)}>Sau</button>
        </nav>
      </>}
  </section>;
}

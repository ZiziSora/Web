import { useEffect, useState } from 'react';
import AddStudentForm from './components/AddStudentForm.jsx';
import StudentList from './components/StudentList.jsx';
import { requestStudents } from './api.js';
import { pageCount } from './pagination.js';

export default function App() {
  const [students, setStudents] = useState([]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    requestStudents({ signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return;
      setStudents(data);
      setPage(1);
      setStatus('ready');
    }).catch(error => {
      if (controller.signal.aborted) return;
      setError(error instanceof TypeError ? 'Không thể kết nối máy chủ. Vui lòng thử lại.' : error.message);
      setStatus('error');
    });
    return () => controller.abort();
  }, [loadAttempt]);

  async function addStudent(input) {
    const student = await requestStudents({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    setStudents(previous => [...previous, student]);
    setPage(pageCount(students.length + 1));
  }

  return <>
    <header className="site-header"><div className="container">
      <p className="eyebrow">Danh sách sinh viên</p><h1>Quản lý sinh viên</h1>
      <p className="subtitle">Thêm sinh viên mới và theo dõi danh sách trên cùng một trang.</p>
    </div></header>
    <main className="container page-layout">
      <AddStudentForm disabled={status !== 'ready'} onAddStudent={addStudent} />
      <StudentList students={students} page={page} onPageChange={setPage} status={status} error={error} onRetry={() => setLoadAttempt(attempt => attempt + 1)} />
    </main>
    <footer className="site-footer">Quản lý sinh viên · Block 4</footer>
  </>;
}

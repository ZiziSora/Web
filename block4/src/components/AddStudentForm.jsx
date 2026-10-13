import { useRef, useState } from 'react';
import { validateStudentInput } from '../../shared/validation.js';

export default function AddStudentForm({ disabled, onAddStudent }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const submitting = useRef(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (disabled || submitting.current) return;
    const validation = validateStudentInput({ name, email });
    if (!validation.student) {
      setNotice({ error: true, message: validation.message });
      return;
    }
    submitting.current = true;
    setSaving(true);
    setNotice(null);
    try {
      await onAddStudent(validation.student);
      setName('');
      setEmail('');
      setNotice({ error: false, message: 'Đã thêm sinh viên thành công.' });
    } catch (error) {
      setNotice({ error: true, message: error instanceof TypeError ? 'Không thể kết nối máy chủ. Vui lòng thử lại.' : error.message });
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return <section className="card form-card" aria-labelledby="create-heading">
    <div className="section-heading">
      <span className="section-number" aria-hidden="true">01</span>
      <div><p className="section-label">Thông tin sinh viên</p><h2 id="create-heading">Thêm sinh viên</h2></div>
    </div>
    {notice && <div className={`alert alert-${notice.error ? 'error' : 'success'}`} role={notice.error ? 'alert' : 'status'}>{notice.message}</div>}
    <form className="student-form" onSubmit={handleSubmit} noValidate aria-busy={saving}>
      <div className="form-group">
        <label htmlFor="name">Họ và tên</label>
        <input id="name" name="name" type="text" autoComplete="name" required maxLength={100} placeholder="Ví dụ: Nguyễn Văn An" value={name} onChange={event => setName(event.target.value)} disabled={disabled || saving} />
      </div>
      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="Ví dụ: an@example.com" value={email} onChange={event => setEmail(event.target.value)} disabled={disabled || saving} />
      </div>
      <button type="submit" disabled={disabled || saving}>{saving ? 'Đang lưu…' : 'Thêm sinh viên'}</button>
    </form>
  </section>;
}

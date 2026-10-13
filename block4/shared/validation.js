export function validateStudentInput(input) {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  const email = typeof input?.email === 'string' ? input.email.trim() : '';
  if (!name || !email) return { code: 'required', message: 'Vui lòng nhập đầy đủ họ tên và email.' };
  if (name.length > 100 || email.length > 254) return { code: 'too_long', message: 'Họ tên tối đa 100 ký tự, email tối đa 254 ký tự.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { code: 'invalid_email', message: 'Email không đúng định dạng.' };
  return { student: { name, email } };
}

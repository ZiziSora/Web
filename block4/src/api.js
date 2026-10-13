export async function requestStudents(options = {}) {
  const response = await fetch('/api/students', options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || 'Không thể xử lý yêu cầu.');
  return body;
}

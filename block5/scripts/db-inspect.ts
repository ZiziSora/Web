import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
try {
  const result = await pool.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);
  console.log(result.rows.length ? JSON.stringify(result.rows, null, 2) : 'Schema public chưa có bảng. Có thể tạo ba model và các bảng nối.');
} catch (error) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : 'CONNECTION_ERROR';
  const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : '';
  const reason = /tenant or user not found/i.test(message) ? 'Supabase không tìm thấy project hoặc tài khoản trong DATABASE_URL.'
    : /password authentication failed|authentication.*failed/i.test(message) ? 'Supabase từ chối thông tin đăng nhập.'
    : /circuit breaker/i.test(message) ? 'Supabase đang tạm khóa kết nối sau nhiều lần xác thực thất bại.'
    : /certificate|ssl/i.test(message) ? 'Không xác thực được chứng chỉ TLS của database.'
    : /max.*client|too many/i.test(message) ? 'Database đã đạt giới hạn kết nối.'
    : 'Kiểm tra DATABASE_URL, trạng thái project và quyền truy cập mạng.';
  console.error(`Không thể kiểm tra database (${code}). ${reason} Chuỗi kết nối không được ghi ra log.`);
  process.exitCode = 1;
} finally { await pool.end(); }

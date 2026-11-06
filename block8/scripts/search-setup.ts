import { databaseConfig } from '../src/config.js';
import 'dotenv/config';
import pg from 'pg';
import { setupSearch } from '../src/search-setup.js';

if (!process.env.DATABASE_URL) throw new Error('Thiếu DATABASE_URL.');
const { url, schema } = databaseConfig();
const pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 15000 });
try {
  const client = await pool.connect();
  try { await setupSearch(client, schema); }
  finally { client.release(); }
  console.log('Search setup hoàn tất: unaccent, pg_trgm, trigger, backfill và chỉ mục.');
} catch {
  console.error('Không thể setup search. Kiểm tra kết nối, schema và quyền tạo extension.');
  process.exitCode = 1;
} finally { await pool.end(); }

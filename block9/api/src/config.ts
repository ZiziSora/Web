/** One schema policy for Prisma CLI, SQL, seed and runtime. */
export function databaseConfig(value = process.env.DATABASE_URL, required = true) {
  if (!value && required) throw new Error('Thiếu DATABASE_URL trong .env.');
  let url: URL;
  try { url = new URL(value ?? 'postgresql://localhost:5432/table?schema=block9'); }
  catch { throw new Error('DATABASE_URL không hợp lệ.'); }
  const schema = url.searchParams.get('schema') ?? 'block9';
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !/^block9(?:_test_[a-f0-9]+)?$/.test(schema))
    throw new Error('Schema phải là block9 hoặc schema kiểm thử block9_test_<hex>.');
  url.searchParams.set('schema', schema);
  return { url: url.toString(), schema };
}

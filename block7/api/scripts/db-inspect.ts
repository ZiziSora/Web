import { createDatabase } from '../src/db.js';
const db = createDatabase();
try {
    const schema = new URL(process.env.DATABASE_URL!).searchParams.get('schema') ?? 'public';
    console.log(await db.$queryRaw `SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema=${schema} ORDER BY table_name,ordinal_position`);
}
catch {
    console.error('Không thể đọc schema. Kiểm tra DATABASE_URL.');
    process.exitCode = 1;
}
finally {
    await db.$disconnect();
}

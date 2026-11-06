import { databaseConfig } from '../src/config.js';
import { createDatabase } from '../src/db.js';
const db = createDatabase();
try {
    const schema = databaseConfig().schema;
    console.log(await db.$queryRaw `SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema=${schema} ORDER BY table_name,ordinal_position`);
}
catch {
    console.error('Không thể đọc schema. Kiểm tra DATABASE_URL.');
    process.exitCode = 1;
}
finally {
    await db.$disconnect();
}

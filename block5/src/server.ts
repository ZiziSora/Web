import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createDatabase } from './db.js';
import { PrismaRestaurantStore } from './store.js';

const db = createDatabase();
const port = Number(process.env.PORT ?? 3005);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT phải là số nguyên từ 0 đến 65535.');
// The compiled server still reads the original EJS templates and static assets.
const root = fileURLToPath(new URL(import.meta.url.includes('/dist/') ? '../../' : '../', import.meta.url));
const app = createApp(new PrismaRestaurantStore(db), { root });
const server = app.listen(port, '127.0.0.1', () => {
  const address = server.address();
  console.log(`The Table · http://localhost:${address && typeof address !== 'string' ? address.port : port}`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => { void db.$disconnect().finally(() => process.exit(0)); });
  });
}

import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createDatabase } from './db.js';
import { PrismaRestaurantStore } from './store.js';
import { PrismaAuthRepository } from './auth-store.js';
import { authConfig } from './auth-config.js';
import { smtpMailer } from './auth-mail.js';

const db = createDatabase();
const port = Number(process.env.PORT ?? 3008);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT phải là số nguyên từ 0 đến 65535.');
// The compiled server still reads the original EJS templates and static assets.
const root = fileURLToPath(new URL(import.meta.url.includes('/dist/') ? '../../' : '../', import.meta.url));
const app = createApp(new PrismaRestaurantStore(db), {
  root, auth: { repository: new PrismaAuthRepository(db), config: authConfig(), mailer: smtpMailer() },
});
const server = app.listen(port, '127.0.0.1', () => {
  const address = server.address();
  console.log(`The Table · http://localhost:${address && typeof address !== 'string' ? address.port : port}`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => { void db.$disconnect().finally(() => process.exit(0)); });
  });
}

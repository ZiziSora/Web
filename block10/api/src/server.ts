import 'dotenv/config';
import { createApp } from './app.js';
import { createDatabase } from './db.js';
import { PrismaRestaurantStore } from './store.js';
import { authConfig } from './auth-config.js';
import { PrismaAuthRepository } from './auth-store.js';
import { smtpMailer } from './auth-mail.js';
import { googleRecaptcha } from './recaptcha.js';
const config = authConfig();
const origin = process.env.SPA_ORIGIN ?? 'http://localhost:5180';
if (config.baseUrl !== origin) throw new Error('APP_BASE_URL phải khớp SPA_ORIGIN.');
const mailer = smtpMailer();
const captcha = googleRecaptcha(process.env.RECAPTCHA_SECRET_KEY ?? '', new URL(origin).hostname);
const db = createDatabase();
const port = Number(process.env.PORT ?? 3010);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT không hợp lệ.');
const server = createApp(new PrismaRestaurantStore(db), {
  origin, auth: { config, mailer, captcha, repository: new PrismaAuthRepository(db) },
}).listen(port, 'localhost', () => console.log(`The Table API http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => void db.$disconnect()));

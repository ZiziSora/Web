import 'dotenv/config';
import { createApp } from './app.js';
import { createDatabase } from './db.js';
import { PrismaRestaurantStore } from './store.js';
const db = createDatabase();
const port = Number(process.env.PORT ?? 3006);
if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error('PORT không hợp lệ.');
const server = createApp(new PrismaRestaurantStore(db)).listen(port, 'localhost', () => console.log(`The Table API http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => server.close(() => void db.$disconnect()));

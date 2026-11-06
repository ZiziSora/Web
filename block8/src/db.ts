import { databaseConfig } from './config.js';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
export function createDatabase(connectionString = process.env.DATABASE_URL) {
    if (!connectionString)
        throw new Error('Thiếu DATABASE_URL trong .env.');
    const config = databaseConfig(connectionString);
    const schema = config.schema;
    connectionString = config.url;
    return new PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 15000 }, { schema }) });
}

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
export function createDatabase(connectionString = process.env.DATABASE_URL) {
    if (!connectionString)
        throw new Error('Thiếu DATABASE_URL trong .env.');
    const schema = new URL(connectionString).searchParams.get('schema') ?? 'public';
    return new PrismaClient({ adapter: new PrismaPg({ connectionString }, { schema }) });
}

import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { createDatabase } from '../src/db.js';
import { PrismaRestaurantStore } from '../src/store.js';
import { jsonInput, IngredientInUseError, type EntityInput } from '../src/domain.js';
test('Prisma thật: Decimal, quan hệ, PATCH, seed idempotent, xóa đồng thời trong schema cô lập', async () => {
    if (!process.env.DATABASE_URL)
        throw new Error('Cần DATABASE_URL để kiểm thử DB.');
    const schema = 'block6_test_' + randomUUID().replaceAll('-', '');
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.set('schema', schema);
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
    const db = createDatabase(url.toString());
    let created = false;
    try {
        await pool.query(`CREATE SCHEMA "${schema}"`);
        created = true;
        const push = spawnSync('npm', ['exec', '--', 'prisma', 'db', 'push'], { env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'pipe', timeout: 90000 });
        assert.equal(push.status, 0, 'Không thể tạo schema kiểm thử.');
        for (let i = 0; i < 2; i++) {
            const seed = spawnSync('npm', ['run', 'seed'], { env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'pipe', timeout: 90000 });
            assert.equal(seed.status, 0, 'Seed thất bại.');
        }
        assert.equal(await db.dish.count(), 12);
        assert.equal(await db.chef.count(), 4);
        assert.equal(await db.ingredient.count(), 12);
        const store = new PrismaRestaurantStore(db);
        const chef = await store.create('chefs', jsonInput('chefs', { name: 'Test', specialty: 'Âu' }) as EntityInput);
        const ingredient = await store.create('ingredients', jsonInput('ingredients', { name: 'Test', unit: 'kg' }) as EntityInput);
        const input = jsonInput('dishes', { name: 'Test', description: 'test', price: '123456.78', category: 'test', chefIds: [chef.id], ingredientIds: [ingredient.id] }) as EntityInput;
        const dish = await store.create('dishes', input);
        assert.equal(dish.price, '123456.78');
        assert.equal(dish.chefs?.[0].specialty, 'Âu');
        await assert.rejects(store.delete('ingredients', ingredient.id), IngredientInUseError);
        const updated = await store.update('dishes', dish.id, { name: 'Updated' });
        assert.equal(updated.price, dish.price);
        assert.equal(updated.ingredients?.length, 1);
        await store.delete('chefs', chef.id);
        assert.ok(await store.find('dishes', dish.id));
        await store.update('dishes', dish.id, { ingredientIds: [] });
        await store.delete('ingredients', ingredient.id);
        for (let i = 0; i < 3; i++) {
            const ing = await store.create('ingredients', { ...input, name: 'Race', unit: 'kg' });
            const results = await Promise.allSettled([store.create('dishes', { ...input, chefIds: [], ingredientIds: [ing.id] }), store.delete('ingredients', ing.id)]);
            assert.ok(results.some(r => r.status === 'rejected'));
        }
    }
    finally {
        await db.$disconnect();
        if (created)
            await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
        await pool.end();
    }
});

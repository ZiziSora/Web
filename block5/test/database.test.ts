import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { before, after, test } from 'node:test';
import pg from 'pg';
import request from 'supertest';
import { createDatabase } from '../src/db.js';
import { PrismaRestaurantStore } from '../src/store.js';
import { createApp } from '../src/app.js';
import { entityValues, formValues, validate, IngredientInUseError, InputError, type EntityInput } from '../src/domain.js';

// Every run owns one random schema. Public tables are never modified by this suite.
const schema = `block5_test_${randomUUID().replaceAll('-', '')}`;
const url = new URL(process.env.DATABASE_URL!);
url.searchParams.set('schema', schema);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
const db = createDatabase(url.toString());
const store = new PrismaRestaurantStore(db);
const app = createApp(store);
let createdSchema = false;
const input = (overrides: Partial<EntityInput> = {}): EntityInput => ({
  name: 'Món thử nghiệm', description: 'Mô tả thử nghiệm', price: '123456.78', category: 'Món Việt',
  available: true, specialty: 'Ẩm thực Việt', unit: 'kg', chefIds: [], ingredientIds: [], ...overrides,
});

before(async () => {
  // schema is generated locally from a UUID, never from user input.
  await pool.query(`CREATE SCHEMA "${schema}"`);
  createdSchema = true;
  const result = await new Promise<number | null>((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push'], {
      env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'pipe', timeout: 90000,
    });
    // Avoid forwarding Prisma output: errors can contain connection information.
    child.stdout.resume(); child.stderr.resume();
    child.on('error', reject); child.on('close', resolve);
  });
  assert.equal(result, 0, 'Không tạo được schema kiểm thử cô lập. Kiểm tra cấu hình kết nối.');
}, { timeout: 120000 });

after(async () => {
  await db.$disconnect();
  if (createdSchema) await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
  await pool.end();
});

test('database thật: Decimal, quan hệ nhiều–nhiều, tìm kiếm, cập nhật và quy tắc xóa', async () => {
  const chefA = await store.create('chefs', input({ name: 'An' }));
  const chefB = await store.create('chefs', input({ name: 'Bình' }));
  const ingredient = await store.create('ingredients', input({ name: 'Hành tây' }));
  const dishA = await store.create('dishes', input({ name: 'Bò lúc lắc', chefIds: [chefA.id, chefB.id], ingredientIds: [ingredient.id] }));
  const dishB = await store.create('dishes', input({ name: 'Cơm gà', chefIds: [chefA.id], ingredientIds: [ingredient.id] }));
  assert.equal(dishA.price, '123456.78');
  assert.equal(dishA.chefs?.length, 2);
  assert.equal((await store.find('chefs', chefA.id))?.dishes?.length, 2);
  assert.equal((await store.list('dishes', 'bÒ'))[0].id, dishA.id);
  assert.equal((await store.list('dishes', '%')).length, 0);

  await assert.rejects(store.delete('ingredients', ingredient.id), IngredientInUseError);
  assert.ok(await store.find('ingredients', ingredient.id));
  await store.delete('chefs', chefA.id);
  assert.equal((await store.find('dishes', dishA.id))?.chefs?.length, 1);
  assert.equal((await store.find('dishes', dishB.id))?.chefs?.length, 0);
  assert.equal((await store.list('dishes')).length, 2);

  await assert.rejects(store.update('dishes', dishA.id, input({ name: 'Không được lưu', ingredientIds: [2147483647] })), InputError);
  assert.equal((await store.find('dishes', dishA.id))?.name, 'Bò lúc lắc');
  await store.update('dishes', dishB.id, input({ name: 'Cơm gà mới', available: false }));
  assert.equal((await store.find('dishes', dishB.id))?.available, false);
  await store.delete('dishes', dishA.id);
  assert.ok(await store.find('chefs', chefB.id));
  assert.ok(await store.find('ingredients', ingredient.id));
  await store.delete('ingredients', ingredient.id);
  assert.equal(await store.find('ingredients', ingredient.id), null);
});

test('database thật: HTTP CRUD của cả ba tài nguyên và redirect 303', async () => {
  for (const resource of ['chefs', 'ingredients', 'dishes'] as const) {
    const base = `/admin/${resource}`;
    const values = { ...entityValues(), name: `HTTP ${resource}`, specialty: 'Món Âu', unit: 'gram', description: 'SSR', price: '25000', category: 'Khai vị' };
    const created = await request(app).post(base).type('form').send(values).expect(303);
    await request(app).get(created.headers.location).expect(200);
    const entity = (await store.list(resource)).find(e => e.name === values.name)!;
    assert.ok(entity);
    const invalid = await request(app).post(`${base}/${entity.id}`).type('form').send({ ...values, name: '', _method: 'PATCH' }).expect(400);
    assert.match(invalid.text, /Vui lòng nhập tên/);
    await request(app).post(`${base}/${entity.id}`).type('form').send({ ...values, name: 'Đã cập nhật', _method: 'PATCH' }).expect(303);
    const confirm = await request(app).get(`${base}/${entity.id}/delete`).expect(200);
    const expires = confirm.text.match(/name="expires" value="([^"]+)"/)![1];
    const token = confirm.text.match(/name="token" value="([^"]+)"/)![1];
    await request(app).post(`${base}/${entity.id}`).type('form').send({ _method: 'DELETE', token, expires }).expect(303);
    assert.equal(await store.find(resource, entity.id), null);
  }
});

test('database thật: kết nối và xóa nguyên liệu đồng thời không âm thầm gỡ nguyên liệu đã lưu', async () => {
  for (let i = 0; i < 3; i++) {
    const ingredient = await store.create('ingredients', input({ name: `Race ${i}` }));
    const results = await Promise.allSettled([
      store.create('dishes', input({ name: `Race dish ${i}`, ingredientIds: [ingredient.id] })),
      store.delete('ingredients', ingredient.id),
    ]);
    assert.ok(results.some(r => r.status === 'rejected'), 'Một trong hai thao tác xung đột phải bị từ chối.');
    if (results[0].status === 'fulfilled') {
      const saved = await store.find('dishes', results[0].value.id);
      assert.equal(saved?.ingredients?.[0]?.id, ingredient.id);
      assert.ok(await store.find('ingredients', ingredient.id));
      await store.delete('dishes', results[0].value.id);
      await store.delete('ingredients', ingredient.id);
    }
  }
});

test('validator không đưa trường lạ hoặc quan hệ không hợp lệ vào Prisma', () => {
  const values = formValues({ name: 'An', specialty: 'Món Việt', id: '999', role: 'admin' });
  const validated = validate('chefs', values);
  assert.ok(!('id' in validated));
  assert.ok(!('role' in validated));
});

import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { OptionsPage } from '../src/list-query.js';
import { MemoryStore } from './memory-store.js';
let store: MemoryStore;
let app: ReturnType<typeof createApp>;
beforeEach(() => { store = new MemoryStore(); app = createApp(store); });
const inputs = { dishes: { name: 'Món thử', description: 'Mô tả', price: '123456.78', category: 'Việt', available: false, chefIds: [1], ingredientIds: [1] }, chefs: { name: 'Bình', specialty: 'Âu' }, ingredients: { name: 'Muối', unit: 'gram' } };
for (const r of ['dishes', 'chefs', 'ingredients'] as const)
    test(`${r}: CRUD, validation, PATCH giữ trường bỏ qua`, async () => {
        const base = '/api/' + r;
        const list = await request(app).get(base).expect(200);
        assert.equal(list.body.ok, true);
        assert.ok(Array.isArray(list.body.data.items));
        const made = await request(app).post(base).send({ ...inputs[r], id: 999, admin: true }).expect(200);
        assert.equal(made.body.ok, true);
        const id = made.body.data.id;
        assert.notEqual(id, 999);
        assert.equal(made.body.data.admin, undefined);
        const detail = await request(app).get(base + '/' + id).expect(200);
        assert.deepEqual(detail.body.data, made.body.data);
        const bad = await request(app).patch(base + '/' + id).send({ name: '' }).expect(200);
        assert.equal(bad.body.error.code, 'VALIDATION_FAILED');
        const patched = await request(app).patch(base + '/' + id).send({ name: 'Tên sửa' }).expect(200);
        assert.equal(patched.body.data.name, 'Tên sửa');
        assert.equal(patched.body.data[r === 'dishes' ? 'price' : r === 'chefs' ? 'specialty' : 'unit'], made.body.data[r === 'dishes' ? 'price' : r === 'chefs' ? 'specialty' : 'unit']);
        assert.equal((await request(app).delete(base + '/' + id).expect(200)).body.data, null);
        assert.equal((await request(app).get(base + '/' + id).expect(200)).body.error.code, 'NOT_FOUND');
    });
test('business errors, invalid JSON and technical errors use correct HTTP and shape', async () => {
    for (const id of ['0', 'abc', '2147483648', '999'])
        assert.equal((await request(app).get('/api/dishes/' + id).expect(200)).body.error.code, 'NOT_FOUND');
    for (const body of [{ price: 1 }, { available: 'false' }, { chefIds: ['1'] }, { price: '1.234' }, { price: '-1' }, {}])
        assert.equal((await request(app).patch('/api/dishes/1').send(body).expect(200)).body.error.code, 'VALIDATION_FAILED');
    const malformed = await request(app).post('/api/dishes').set('Content-Type', 'application/json').send('{').expect(400);
    assert.equal(malformed.body.ok, undefined);
    assert.equal((await request(app).get('/api/missing').expect(404)).body.ok, undefined);
    store.list = async () => { throw new Error('postgresql://secret'); };
    const logs: string[] = [];
    const res = await request(createApp(store, { logger: { error: m => logs.push(m) } })).get('/api/dishes').expect(500);
    assert.equal(res.body.ok, undefined);
    assert.doesNotMatch(JSON.stringify(res.body) + logs.join(''), /secret|postgresql/);
});
test('CORS handles configured origin, preflight and error paths', async () => {
    const origin = 'http://localhost:5176';
    for (const path of ['/api/dishes', '/api/missing']) {
        const res = await request(app).get(path).set('Origin', origin);
        assert.equal(res.headers['access-control-allow-origin'], origin);
    }
    const denied = await request(app).get('/api/dishes').set('Origin', 'http://evil.test');
    assert.equal(denied.headers['access-control-allow-origin'], undefined);
    await request(app).options('/api/dishes/1').set('Origin', origin).set('Access-Control-Request-Method', 'PATCH').expect(204).expect('Access-Control-Allow-Origin', origin);
});
test('GET never writes, search and relation/deletion rules', async () => {
    const before = structuredClone(store.rows);
    await request(app).get('/api/ingredients/1');
    assert.deepEqual(store.rows, before);
    assert.equal((await request(app).get('/api/dishes?q=BÒ')).body.data.items.length, 1);
    assert.equal((await request(app).get('/api/dishes?q=unknown')).body.data.items.length, 0);
    const blocked = await request(app).delete('/api/ingredients/1').expect(200);
    assert.equal(blocked.body.error.code, 'VALIDATION_FAILED');
    assert.equal(blocked.body.error.details.dishes[0].id, 1);
    const clear = await request(app).patch('/api/dishes/1').send({ ingredientIds: [], chefIds: [] });
    assert.deepEqual(clear.body.data.ingredients, []);
    assert.deepEqual(clear.body.data.chefs, []);
    assert.equal((await request(app).delete('/api/ingredients/1')).body.ok, true);
});
test('paged lists: boundaries, AND filters, stable sorts and validation', async () => {
    for (const count of [0, 1, 6, 7, 13]) {
        store.rows.dishes = Array.from({ length: count }, (_, i) => ({ id: i + 1, name: 'Món ' + i, description: 'bí đỏ', price: String(i * 100), category: i % 2 ? 'B' : 'A', available: i % 2 === 0, chefs: [], ingredients: [] }));
        const data = (await request(app).get('/api/dishes?page=999')).body.data;
        assert.equal(data.meta.total, count);
        assert.equal(data.meta.page, Math.max(1, Math.ceil(count / 6)));
        assert.equal(data.items.length, count ? count % 6 || 6 : 0);
    }
    const filtered = (await request(app).get('/api/dishes?mode=advanced&q=mon&category=A&available=true&minPrice=200&maxPrice=800&sort=price-desc')).body.data;
    assert.deepEqual(filtered.items.map((row: { id: number }) => row.id), [9, 7, 5, 3]);
    for (const query of ['page=0', 'pageSize=51', 'q[]=a', 'mode=unknown', 'sort=price;DROP', 'minPrice=-1', 'minPrice=2&maxPrice=1', 'available=yes', 'page=1&page=2']) {
        assert.equal((await request(app).get('/api/dishes?' + query)).body.error.code, 'VALIDATION_FAILED', query);
    }
    for (const query of ['mode=fuzzy', 'mode=fulltext', 'sort=price-asc', 'available=true']) {
        assert.equal((await request(app).get('/api/chefs?' + query)).body.error.code, 'VALIDATION_FAILED');
    }
});
test('options use bounded cursors and facets use their own route', async () => {
    store.rows.ingredients = Array.from({ length: 13 }, (_, i) => ({ id: i + 1, name: 'Hành ' + i, unit: 'kg' }));
    const ids: number[] = [];
    let after: number | null = null;
    do {
        const data: OptionsPage = (await request(app).get('/api/ingredients/options?q=hanh' + (after ? '&after=' + after : ''))).body.data;
        assert.ok(data.items.length <= 6);
        ids.push(...data.items.map((row: { id: number }) => row.id));
        after = data.nextCursor;
        assert.equal(data.hasMore, after !== null);
    } while (after);
    assert.deepEqual(ids, Array.from({ length: 13 }, (_, i) => i + 1));
    assert.equal((await request(app).get('/api/ingredients/options?after=abc')).body.error.code, 'VALIDATION_FAILED');
    assert.deepEqual((await request(app).get('/api/dishes/facets')).body.data, { categories: ['Món Việt'] });
});

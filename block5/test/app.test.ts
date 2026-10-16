import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { resources } from '../src/domain.js';
import { MemoryStore } from './memory-store.js';

let store: MemoryStore;
let app: ReturnType<typeof createApp>;
beforeEach(() => { store = new MemoryStore(); app = createApp(store); });
const dish = { name: '  Pasta nấm  ', description: 'Món thơm ngon', price: '125000.50', category: 'Món Âu', available: 'false', chefIds: ['1'], ingredientIds: ['1'] };
const inputs = { dishes: dish, chefs: { name: 'Linh', specialty: 'Món Âu' }, ingredients: { name: 'Nấm', unit: 'gram' } };
export function confirmation(html: string) {
  return { expires: html.match(/name="expires" value="([^"]+)"/)![1], token: html.match(/name="token" value="([^"]+)"/)![1] };
}

test('redirect trang đầu và render HTML SSR không chứa script', async () => {
  await request(app).get('/').expect(302).expect('Location', '/dishes');
  await request(app).get('/admin').expect(302).expect('Location', '/admin/dishes');
  const res = await request(app).get('/dishes').expect(200);
  assert.match(res.text, /Bò lúc lắc/);
  assert.match(res.text, /href="\/dishes\/1"/);
  assert.doesNotMatch(res.text, /<script|fetch\(|XMLHttpRequest/i);
  assert.match(res.headers['content-security-policy'], /script-src 'none'/);
});

test('tìm theo tên, giữ query, escape HTML và trạng thái không có kết quả', async () => {
  const found = await request(app).get('/dishes').query({ q: '  bò  ' }).expect(200);
  assert.match(found.text, /Bò lúc lắc/);
  assert.match(found.text, /value="bò"/);
  const empty = await request(app).get('/dishes').query({ q: '<script>unknown</script>' }).expect(200);
  assert.match(empty.text, /Chưa tìm thấy/);
  assert.match(empty.text, /&lt;script&gt;/);
  assert.doesNotMatch(empty.text, /<script>/);
});

test('chi tiết hiển thị đủ dữ liệu và các liên kết', async () => {
  const res = await request(app).get('/dishes/1').expect(200);
  for (const text of ['Bò lúc lắc', 'Bò mềm, hành giòn.', 'Món Việt', '165.000', 'Sẵn sàng phục vụ', 'Hành tây', 'kg', 'An']) assert.ok(res.text.includes(text));
});

test('404 với ID sai hoặc không có trên trang khách và mọi trang admin', async () => {
  for (const id of ['abc', '0', '-1', '1.5', '2147483648', '999']) {
    await request(app).get(`/dishes/${id}`).expect(404);
    for (const resource of resources) {
      await request(app).get(`/admin/${resource}/${id}/edit`).expect(404);
      await request(app).get(`/admin/${resource}/${id}/delete`).expect(404);
      await request(app).post(`/admin/${resource}/${id}`).type('form').send({ _method: 'PATCH', ...inputs[resource] }).expect(404);
      await request(app).post(`/admin/${resource}/${id}`).type('form').send({ _method: 'DELETE' }).expect(404);
    }
  }
  await request(app).get('/khong-co').expect(404);
});

for (const resource of resources) {
  test(`${resource}: danh sách, form, POST, PATCH, xác nhận DELETE và PRG 303`, async () => {
    const base = `/admin/${resource}`;
    await request(app).get(base).expect(200);
    await request(app).get(`${base}/new`).expect(200);
    const create = await request(app).post(base).type('form').send({ ...inputs[resource], id: '999', admin: 'true' }).expect(303);
    assert.equal(create.headers.location, `${base}?status=created`);
    assert.equal(store.rows[resource].length, 2);
    assert.equal(store.rows[resource][1].id, 2);
    assert.ok(!('admin' in store.rows[resource][1]));
    await request(app).get(create.headers.location).expect(200);
    await request(app).get(create.headers.location).expect(200);
    assert.equal(store.rows[resource].length, 2);
    const edit = await request(app).get(`${base}/2/edit`).expect(200);
    assert.match(edit.text, /name="_method" value="PATCH"/);
    await request(app).post(`${base}/2`).type('form').send({ ...inputs[resource], name: 'Tên đã sửa', _method: 'PATCH' }).expect(303).expect('Location', `${base}?status=updated`);
    assert.equal(store.rows[resource][1].name, 'Tên đã sửa');
    const confirm = await request(app).get(`${base}/2/delete`).expect(200);
    assert.equal(store.rows[resource].length, 2);
    assert.match(confirm.text, /Xác nhận xóa/);
    await request(app).post(`${base}/2`).type('form').send({ _method: 'DELETE', ...confirmation(confirm.text) }).expect(303).expect('Location', `${base}?status=deleted`);
    assert.equal(store.rows[resource].length, 1);
  });

  test(`${resource}: lỗi 400 giữ giá trị trên form thêm và sửa`, async () => {
    for (const edit of [false, true]) {
      const res = await request(app).post(`/admin/${resource}${edit ? '/1' : ''}`).type('form').send({
        ...inputs[resource], name: '   ', ...(edit ? { _method: 'PATCH' } : {}),
      }).expect(400);
      assert.match(res.text, /value="   "/);
      assert.match(res.text, /Vui lòng nhập tên/);
      assert.equal(store.rows[resource].length, 1);
      assert.notEqual(store.rows[resource][0].name, '   ');
    }
  });
}

test('giá, boolean, văn bản, ID quan hệ không hợp lệ trả 400 và giữ lựa chọn', async () => {
  for (const change of [{ price: '-1' }, { price: '1e6' }, { price: '99999999999' }, { price: '1.234' }, { available: 'yes' }, { description: '' }, { category: '' }, { chefIds: ['999'] }, { ingredientIds: ['x'] }]) {
    const res = await request(app).post('/admin/dishes').type('form').send({ ...dish, ...change }).expect(400);
    assert.match(res.text, /value="  Pasta nấm  "/);
    assert.match(res.text, /value="1" checked/);
    assert.equal(store.rows.dishes.length, 1);
  }
  await request(app).post('/admin/dishes').type('form').send({ ...dish, price: '0', chefIds: [], ingredientIds: [] }).expect(303);
  assert.equal(store.rows.dishes[1].available, false);
});

test('PATCH lỗi giữ nguyên quan hệ; PATCH hợp lệ thay thế và cho gỡ tất cả', async () => {
  await request(app).post('/admin/dishes/1').type('form').send({ ...dish, price: 'sai', chefIds: [], ingredientIds: [], _method: 'PATCH' }).expect(400);
  assert.equal(store.rows.dishes[0].chefs?.length, 1);
  await request(app).post('/admin/dishes/1').type('form').send({ ...dish, chefIds: [], ingredientIds: [], _method: 'PATCH' }).expect(303);
  assert.deepEqual(store.rows.dishes[0].ingredients, []);
  assert.deepEqual(store.rows.dishes[0].chefs, []);
});

test('không xóa nếu bỏ qua xác nhận; GET không đổi dữ liệu; chỉ override POST body', async () => {
  const snapshot = structuredClone(store.rows);
  await request(app).get('/admin/chefs/1/delete').expect(200);
  await request(app).get('/admin/chefs/1?_method=DELETE').expect(404);
  await request(app).get('/admin/chefs/1?_method=PATCH').expect(404);
  await request(app).post('/admin/chefs/1').type('form').send({ _method: 'DELETE' }).expect(400);
  await request(app).post('/admin/chefs/1').type('form').send({ _method: 'DELETE', expires: String(Date.now() - 1), token: 'a'.repeat(64) }).expect(400);
  assert.deepEqual(store.rows, snapshot);
});

test('xóa đầu bếp chỉ gỡ liên kết, giữ món và nguyên liệu', async () => {
  const confirm = await request(app).get('/admin/chefs/1/delete');
  await request(app).post('/admin/chefs/1').type('form').send({ _method: 'DELETE', ...confirmation(confirm.text) }).expect(303);
  assert.equal(store.rows.dishes.length, 1);
  assert.equal(store.rows.ingredients.length, 1);
  assert.deepEqual(store.rows.dishes[0].chefs, []);
});

test('chặn xóa nguyên liệu đang dùng kể cả khi liên kết được thêm sau trang xác nhận', async () => {
  const get = await request(app).get('/admin/ingredients/1/delete').expect(200);
  assert.match(get.text, /Chưa thể xóa nguyên liệu/);
  assert.match(get.text, /Bò lúc lắc/);
  assert.doesNotMatch(get.text, /type="submit"/);
  store.rows.dishes[0].ingredients = [];
  const confirm = await request(app).get('/admin/ingredients/1/delete').expect(200);
  store.rows.dishes[0].ingredients = [{ id: 1, name: 'Hành tây', unit: 'kg' }];
  await request(app).post('/admin/ingredients/1').type('form').send({ _method: 'DELETE', ...confirmation(confirm.text) }).expect(400);
  assert.equal(store.rows.ingredients.length, 1);
  store.rows.dishes[0].ingredients = [];
  await request(app).post('/admin/ingredients/1').type('form').send({ _method: 'DELETE', ...confirmation(confirm.text) }).expect(303);
});

test('escape HTML ở tên, mô tả, form và không tiết lộ chuỗi kết nối khi lỗi', async () => {
  store.rows.dishes[0].name = '<script>alert(1)</script>';
  store.rows.dishes[0].description = '<img src=x onerror=alert(1)>';
  for (const path of ['/dishes', '/dishes/1', '/admin/dishes', '/admin/dishes/1/edit', '/admin/dishes/1/delete']) {
    const res = await request(app).get(path).expect(200);
    assert.match(res.text, /&lt;script&gt;/);
    assert.doesNotMatch(res.text, /<script>|<img src=x/);
  }
  const logs: string[] = [];
  store.list = async () => { throw new Error('postgresql://secret:password@hidden/database'); };
  const failed = await request(createApp(store, { logger: { error: message => logs.push(message) } })).get('/dishes').expect(500);
  assert.doesNotMatch(failed.text + logs.join(''), /secret|password|postgresql/);
});

test('lỗi ghi không chuyển thành thành công và không làm thay đổi dữ liệu', async () => {
  const snapshot = structuredClone(store.rows);
  store.create = async () => { throw new Error('database unavailable'); };
  const quiet = createApp(store, { logger: { error() {} } });
  await request(quiet).post('/admin/dishes').type('form').send(dish).expect(500);
  assert.deepEqual(store.rows, snapshot);
});

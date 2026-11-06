import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restaurantFixture } from './auth-fixture.js';
import { MemoryStore } from './memory-store.js';
import { databaseConfig } from '../src/config.js';
import { resources, type Resource } from '../src/domain.js';

async function fixture() {
  const store = new MemoryStore();
  for (let id = 2; id <= 20; id++) {
    store.rows.chefs.push({ id, name: `Đầu bếp ${id}`, specialty: 'Việt' });
    store.rows.ingredients.push({ id, name: `Nguyên liệu ${id}`, unit: 'kg' });
  }
  for (let id = 2; id <= 13; id++) store.rows.dishes.push({ ...structuredClone(store.rows.dishes[0]), id, name: `Món ${String(id).padStart(2,'0')}`, price: String(id*1000), category: id%2 ? 'A' : 'B', available: id%2 === 0 });
  return { store, ...await restaurantFixture(store) };
}
const token = (html: string) => Object.fromEntries(['token','expires'].map(key => [key, html.match(new RegExp(`name="${key}" value="([^"]+)"`))![1]]));
const dish = { name:'Món mới', description:'Mô tả', price:'123456.78', category:'Việt', available:'true', chefIds:['1','2'], ingredientIds:['1','2'] };

test('SSR delivers actual menu, details, forms and all list pages in HTML', async () => {
  const { app, client } = await fixture();
  const menu = await client.get('/dishes').expect(200).expect('Content-Type', /html/);
  assert.match(menu.text, /Bò lúc lắc/); assert.match(menu.text, /book-leaf/);
  assert.equal((menu.text.match(/<article /g) ?? []).length, 6);
  assert.doesNotMatch(menu.text,/react|id="root"|fetch\(/i);
  await client.get('/').expect(302).expect('Location','/dishes');
  await client.get('/admin').expect(302).expect('Location','/admin/dishes');
  assert.match((await client.get('/dishes/1').expect(200)).text,/Hành tây/);
  for (const resource of resources) {
    const page = await client.get(`/admin/${resource}?page=2`).expect(200);
    assert.match(page.text,/Trang 2/);
    const form = await client.get(`/admin/${resource}/new`).expect(200);
    assert.match(form.text,/method="post"/);
  }
  const form = await client.get('/admin/dishes/1/edit').expect(200);
  assert.equal((form.text.match(/class="checkbox-option/g) ?? []).length,40);
  assert.match(form.text,/name="chefIds" value="1" checked/);
});

test('paging preserves query, clamps ranges and invalid pages; search and filters run before pagination', async () => {
  const { app, store, client } = await fixture();
  const last = await client.get('/dishes?page=3').expect(200);
  assert.equal((last.text.match(/<article /g) ?? []).length,1);
  await client.get('/dishes?page=999&q=mon&sort=price-desc').expect(302).expect('Location','/dishes?q=mon&sort=price-desc&page=2#menu');
  await client.get('/dishes?page=nope').expect(302).expect('Location','/dishes#menu');
  const found = await client.get('/dishes?q=hanh').expect(200);
  assert.match(found.text,/Bò lúc lắc/);
  const filtered = await client.get('/admin/dishes?q=mon&category=B&minPrice=4000&maxPrice=10000&available=true&sort=price-desc').expect(200);
  assert.match(filtered.text,/Món 10/); assert.doesNotMatch(filtered.text,/>Món 12</);
  assert.match(filtered.text,/name="minPrice"[^>]*value="4000"/);
  for (const resource of resources) {
    const page = await client.get(`/admin/${resource}?page=999`).expect(302);
    assert.ok(page.headers.location.includes('page='+Math.ceil(store.rows[resource].length/6)));
  }
  await client.get('/dishes?minPrice=100&maxPrice=1').expect(400);
  await client.get('/dishes?sort=bogus').expect(400);
  await client.get('/dishes?q=a&q=b').expect(400);
  const empty = await client.get('/dishes?q=missing').expect(200);
  assert.match(empty.text,/Chưa có món phù hợp/);
});

test('all resources support native form CRUD, validation and post-redirect-get', async () => {
  const { app, store, client } = await fixture();
  for (const resource of resources) {
    const input = resource === 'dishes' ? dish : resource === 'chefs' ? {name:'Đầu mới',specialty:'Âu'} : {name:'Nguyên liệu mới',unit:'gram'};
    await client.post(`/admin/${resource}`).type('form').send(input).expect(303).expect('Location',`/admin/${resource}?status=created`);
    const entity = store.rows[resource].at(-1)!;
    if (resource === 'dishes') { assert.equal(entity.price,'123456.78'); assert.equal(entity.chefs?.length,2); }
    await client.get(`/admin/${resource}?status=created`).expect(200);
    const total = store.rows[resource].length;
    await client.get(`/admin/${resource}?status=created`).expect(200);
    assert.equal(store.rows[resource].length,total);
    await client.post(`/admin/${resource}/${entity.id}`).type('form').send({...input,name:'Đã sửa',_method:'PATCH',chefIds:[],ingredientIds:[]}).expect(303);
    assert.equal((await store.find(resource,entity.id))?.name,'Đã sửa');
    await client.post(`/admin/${resource}/${entity.id}`).type('form').send({_method:'DELETE'}).expect(400);
    const confirmation = await client.get(`/admin/${resource}/${entity.id}/delete`).expect(200);
    assert.ok(await store.find(resource,entity.id));
    await client.post(`/admin/${resource}/${entity.id}`).type('form').send({_method:'DELETE',...token(confirmation.text)}).expect(303);
    assert.equal(await store.find(resource,entity.id),null);
  }
});

test('invalid forms preserve values, checked/stale relations and escape HTML', async () => {
  const { app, store, client } = await fixture();
  const response = await client.post('/admin/dishes').type('form').send({...dish,name:'<script>alert(1)</script>',price:'invalid',chefIds:['1','999']}).expect(400);
  assert.match(response.text,/&lt;script&gt;/); assert.doesNotMatch(response.text,/<script>alert/);
  assert.match(response.text,/name="chefIds" value="1" checked/);
  assert.match(response.text,/name="chefIds" value="999" checked/);
  assert.equal(store.rows.dishes.length,13);
  await client.post('/admin/dishes').type('form').send({...dish,chefIds:['999']}).expect(400);
  await client.post('/admin/chefs').type('form').send({name:'x',specialty:''}).expect(400);
  const edit = await client.post('/admin/dishes/1').type('form').send({...dish,_method:'PATCH',price:'-1'}).expect(400);
  assert.match(edit.text,/Món mới/); assert.equal((await store.find('dishes',1))?.name,'Bò lúc lắc');
});

test('deletion tokens bind resource and ID; linked ingredients cannot be removed', async () => {
  const { app, store, client } = await fixture();
  const confirmation = await client.get('/admin/ingredients/1/delete').expect(200);
  assert.doesNotMatch(confirmation.text,/Xác nhận xóa/);
  assert.match(confirmation.text,/\/admin\/dishes\/1\/edit/);
  const other = await client.get('/admin/ingredients/2/delete').expect(200);
  await client.post('/admin/ingredients/1').type('form').send({_method:'DELETE',...token(other.text)}).expect(400);
  // The ingredient becomes linked after confirmation; check again at write time.
  store.rows.dishes[0].ingredients!.push({id:2,name:'Nguyên liệu 2'});
  await client.post('/admin/ingredients/2').type('form').send({_method:'DELETE',...token(other.text)}).expect(400);
  assert.ok(await store.find('ingredients',2));
  const expired={...token(other.text),expires:'1000000000000'};
  await client.post('/admin/ingredients/2').type('form').send({_method:'DELETE',...expired}).expect(400);
});

test('404, safe errors, static files and override constraints', async () => {
  const { app, store, client } = await fixture();
  for (const path of ['/unknown','/api/dishes','/dishes/nope','/dishes/999','/admin/nope','/missing.css']) await client.get(path).expect(404);
  await client.get('/app.js').expect(200).expect('Content-Type',/javascript/);
  await client.get('/styles.css').expect(200).expect('Content-Type',/css/);
  await client.get('/admin/dishes/1?_method=DELETE').expect(404);
  assert.ok(await store.find('dishes',1));
  store.list=async()=>{throw new Error('postgresql://secret:password@host');};
  const errors:string[]=[];
  const { client: errorClient } = await restaurantFixture(store,{error:message=>errors.push(message)});
  const response=await errorClient.get('/dishes').expect(500);
  assert.match(response.text,/Thử lại/); assert.doesNotMatch(response.text,/secret|password/);
  assert.doesNotMatch(errors.join(),/secret|password/);
  store.update=async()=>{throw new Error('Database unavailable');};
  const failedEdit=await errorClient.post('/admin/dishes/1').type('form').send({...dish,_method:'PATCH'}).expect(500);
  assert.match(failedEdit.text,/href="\/admin\/dishes\/1\/edit">Thử lại/);

});

test('database config consistently isolates block8 and temporary test schemas', () => {
  assert.equal(databaseConfig('postgresql://localhost/db').schema,'block8');
  assert.match(databaseConfig('postgresql://localhost/db').url,/schema=block8/);
  assert.equal(databaseConfig('postgresql://localhost/db?schema=block8_test_a1').schema,'block8_test_a1');
  assert.throws(()=>databaseConfig('postgresql://localhost/db?schema=public'));
  assert.throws(()=>databaseConfig('postgresql://localhost/db?schema=block7'));
});

import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { createApp } from '../src/app.js';
import { MemoryStore } from '../test/memory-store.js';
import { entityValues, validate } from '../src/domain.js';

const store = new MemoryStore();
for (const [name, category, price, available] of [
  ['Pasta nấm kem', 'Từ căn bếp Âu', '145000', true], ['Cơm gà thảo mộc', 'Hương vị Việt', '125000', true],
  ['Tôm áp chảo bơ tỏi', 'Món sẻ chia', '185000', true], ['Cơm chiên nhà Table', 'Hương vị Việt', '115000', true],
  ['Gà sốt nấm', 'Từ căn bếp Âu', '155000', false], ['Salad cà chua phô mai', 'Khởi đầu nhẹ nhàng', '85000', true],
  ['Pasta bò cà chua', 'Từ căn bếp Âu', '155000', true], ['Cơm nấm chay', 'Vườn xanh', '95000', true],
  ['Heo nướng hành tây', 'Hương vị Việt', '135000', true], ['Trứng cuộn phô mai', 'Món sẻ chia', '75000', true],
  ['Súp nấm ấm', 'Khởi đầu nhẹ nhàng', '65000', false],
] as const) {
  await store.create('dishes', validate('dishes', {
    ...entityValues(), name, category, price, available: String(available), chefIds: ['1'], ingredientIds: ['1'],
    description: 'Những nguyên liệu giản dị được chăm chút từ căn bếp. Một hương vị ấm áp, ngon hơn khi cùng nhau thưởng thức.',
  }));
}
const server = createApp(store).listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.on('listening', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Không mở được server kiểm thử.');
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
await mkdir('artifacts', { recursive: true });
try {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/dishes`);
  await page.screenshot({ path: 'artifacts/menu-desktop.png', fullPage: true });
  assert.equal(await page.locator('.dish-card').count(), 12);
  await page.getByRole('searchbox').fill('không tồn tại');
  await page.getByRole('button', { name: 'Tìm món' }).click();
  await page.getByRole('heading', { name: 'Chưa tìm thấy món bạn muốn.' }).waitFor();
  await page.goto(`${origin}/dishes/1`);
  await page.getByRole('heading', { name: 'Đầu bếp biết nấu món này' }).waitFor();
  await page.screenshot({ path: 'artifacts/detail-desktop.png', fullPage: true });
  await page.goto(`${origin}/admin/dishes`);
  await page.screenshot({ path: 'artifacts/admin-desktop.png', fullPage: true });
  await page.goto(`${origin}/admin/dishes/new`);
  await page.getByRole('button', { name: 'Thêm món ăn' }).click();
  await page.getByRole('alert').waitFor();
  await page.getByLabel('Tên món ăn').fill('Món kiểm thử trình duyệt');
  await page.getByLabel('Mô tả món ăn').fill('Hoạt động khi tắt JavaScript.');
  await page.getByLabel('Giá (VNĐ)').fill('99000');
  await page.getByLabel('Danh mục').fill('Món thử');
  await page.getByLabel('An', { exact: true }).check();
  await page.screenshot({ path: 'artifacts/form-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Thêm món ăn' }).click();
  await page.getByRole('status').waitFor();
  await page.reload();
  assert.equal(store.rows.dishes.filter(d => d.name === 'Món kiểm thử trình duyệt').length, 1);
  const last = store.rows.dishes.at(-1)!;
  await page.goto(`${origin}/admin/dishes/${last.id}/delete`);
  await page.getByRole('button', { name: 'Xác nhận xóa' }).click();
  await page.getByRole('status').waitFor();
  assert.ok(!store.rows.dishes.some(d => d.id === last.id));
  await page.goto(`${origin}/admin/ingredients/1/delete`);
  assert.equal(await page.getByRole('button', { name: 'Xác nhận xóa' }).count(), 0);
  await page.screenshot({ path: 'artifacts/delete-blocked.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  for (const [route, name] of [['/dishes', 'menu'], ['/dishes/1', 'detail'], ['/admin/dishes', 'admin'], ['/admin/dishes/new', 'form'], ['/dishes/not-a-number', '404']]) {
    await page.goto(`${origin}${route}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Trang ${route} tràn ngang trên mobile.`);
    await page.screenshot({ path: `artifacts/${name}-mobile.png`, fullPage: true });
  }
  assert.deepEqual(errors, []);
  if (existsSync('dist/src/server.js')) {
    const production = spawn(process.execPath, ['dist/src/server.js'], { env: { ...process.env, PORT: '0' }, stdio: 'pipe' });
    production.stderr.resume();
    try {
      const productionOrigin = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Production server không khởi động trong 15 giây.')), 15000);
        production.on('error', error => { clearTimeout(timer); reject(error); });
        production.on('exit', code => { clearTimeout(timer); reject(new Error(`Production server dừng sớm (${code}).`)); });
        production.stdout.on('data', (data: Buffer) => {
          const match = data.toString().match(/http:\/\/localhost:(\d+)/);
          if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
        });
      });
      const errorPage = await page.goto(`${productionOrigin}/missing-page`);
      assert.equal(errorPage?.status(), 404);
      await page.getByRole('heading', { name: 'Có lẽ bạn đã rẽ nhầm bàn.' }).waitFor();
      assert.equal((await context.request.get(`${productionOrigin}/styles.css`)).status(), 200);
    } finally {
      production.kill('SIGTERM');
      await new Promise<void>(resolve => production.once('close', () => resolve()));
    }
  }
  await context.close();
  console.log('Browser QA đạt: desktop/mobile, không JavaScript, tìm kiếm, validation, tạo/xóa, chống lặp khi reload, chặn xóa nguyên liệu, 404, khởi động production và static assets. Ảnh chụp: artifacts/.');
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { StudentStore } from '../server/student-store.js';
import { PAGE_SIZE, pageCount, pageItems } from '../src/pagination.js';

async function fixture(t, initial = []) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'block4-'));
  const dataFile = path.join(directory, 'students.json');
  await fs.writeFile(dataFile, JSON.stringify(initial));
  const server = createApp({ dataFile, logger: { error() {} } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  });
  const url = `http://127.0.0.1:${server.address().port}/api/students`;
  const post = body => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { url, post, dataFile, directory };
}

test('GET, create, trim and persistence across a new store instance', async t => {
  const { url, post, dataFile } = await fixture(t);
  assert.deepEqual(await (await fetch(url)).json(), []);
  const response = await post({ name: '  Nguyễn Văn An  ', email: '  an@example.com  ' });
  assert.equal(response.status, 201);
  const student = await response.json();
  assert.deepEqual(student, { id: 1, name: 'Nguyễn Văn An', email: 'an@example.com' });
  assert.deepEqual(await new StudentStore(dataFile).getAll(), [student]);
  assert.deepEqual(await (await fetch(url)).json(), [student]);
});

test('invalid input and case-insensitive duplicate email do not change the file', async t => {
  const { post, dataFile } = await fixture(t, [{ id: 8, name: 'An', email: 'an@example.com' }]);
  const before = await fs.readFile(dataFile, 'utf8');
  for (const input of [null, {}, { name: ' ', email: 'a@b.com' }, { name: 'A', email: 'bad' }, { name: 'x'.repeat(101), email: 'a@b.com' }, { name: 'A', email: 'x'.repeat(255) }]) {
    assert.equal((await post(input)).status, 400);
  }
  const duplicate = await post({ name: 'Khác', email: 'AN@EXAMPLE.COM' });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).code, 'duplicate_email');
  assert.equal(await fs.readFile(dataFile, 'utf8'), before);
});

test('concurrent writes have distinct IDs and preserve every student; rejected write does not block queue', async t => {
  const { post, dataFile } = await fixture(t);
  const responses = await Promise.all(Array.from({ length: 10 }, (_, i) => post({ name: `Student ${i}`, email: `s${i}@example.com` })));
  assert.ok(responses.every(response => response.status === 201));
  const saved = await new StudentStore(dataFile).getAll();
  assert.equal(saved.length, 10);
  assert.equal(new Set(saved.map(student => student.id)).size, 10);
  const same = await Promise.all([post({ name: 'A', email: 'same@example.com' }), post({ name: 'B', email: 'SAME@example.com' })]);
  assert.deepEqual(same.map(response => response.status).sort(), [201, 409]);
  assert.equal((await post({ name: 'C', email: 'next@example.com' })).status, 201);
  assert.equal((await new StudentStore(dataFile).getAll()).length, 12);
});

test('missing or corrupt data returns 500 without seeding or overwriting', async t => {
  const { url, post, dataFile } = await fixture(t);
  for (const content of ['broken JSON', '{}', '[{"id":1}]']) {
    await fs.writeFile(dataFile, content);
    assert.equal((await fetch(url)).status, 500);
    assert.equal((await post({ name: 'A', email: 'a@b.com' })).status, 500);
    assert.equal(await fs.readFile(dataFile, 'utf8'), content);
  }
  await fs.unlink(dataFile);
  assert.equal((await fetch(url)).status, 500);
  assert.equal((await post({ name: 'A', email: 'a@b.com' })).status, 500);
  await assert.rejects(fs.access(dataFile));
});

test('failed write keeps data intact, removes temporary file and allows retry', async t => {
  const { dataFile, directory } = await fixture(t);
  const store = new StudentStore(dataFile);
  const originalRename = fs.rename;
  fs.rename = async () => { throw new Error('Simulated disk failure'); };
  try {
    await assert.rejects(store.create({ name: 'A', email: 'a@b.com' }));
    assert.deepEqual(await store.getAll(), []);
    assert.deepEqual(await fs.readdir(directory), ['students.json']);
  } finally {
    fs.rename = originalRename;
  }
  assert.equal((await store.create({ name: 'A', email: 'a@b.com' })).id, 1);
});

test('malformed body and unknown API return JSON errors', async t => {
  const { url } = await fixture(t);
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'invalid_body');
  const missing = await fetch(`${url}/unknown`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).code, 'not_found');
});

test('pagination has six pages for 52 students and handles growth and distant pages', () => {
  assert.equal(PAGE_SIZE, 10);
  assert.equal(pageCount(52), 6);
  assert.equal(pageCount(60), 6);
  assert.equal(pageCount(61), 7);
  const students = Array.from({ length: 52 }, (_, i) => i + 1);
  const pages = Array.from({ length: pageCount(students.length) }, (_, i) => students.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE));
  assert.equal(pages.at(-1).length, 2);
  assert.deepEqual(pages.flat(), students);
  for (const current of [1, 5, 10]) {
    const items = pageItems(current, 10);
    assert.equal(items[0], 1);
    assert.equal(items.at(-1), 10);
    assert.ok(items.includes(current));
    assert.ok(items.some(item => typeof item === 'string'));
  }
});

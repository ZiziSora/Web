import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

test('development and production serve CSR, assets and persistent API without document redirects', { timeout: 30000 }, async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'block4-runtime-'));
  const dataFile = path.join(directory, 'students.json');
  await fs.copyFile(path.join(root, 'data/students.json'), dataFile);
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const seed = JSON.parse(await fs.readFile(dataFile, 'utf8'));
  let savedStudent;
  for (const development of [true, false]) {
    let output = '';
    const child = spawn(process.execPath, [path.join(root, 'server/index.js'), ...(development ? ['--dev'] : [])], {
      cwd: directory, env: { ...process.env, PORT: '0', DATA_FILE: dataFile }, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const exited = once(child, 'exit');
    try {
      const port = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Server startup timeout: ${output}`)), 10000);
        child.once('error', error => { clearTimeout(timer); reject(error); });
        child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${output}`)); });
        child.stdout.on('data', chunk => {
          output += chunk;
          const match = output.match(/localhost:(\d+)\/students/);
          if (match) { clearTimeout(timer); resolve(Number(match[1])); }
        });
        child.stderr.on('data', chunk => { output += chunk; });
      });
      const base = `http://127.0.0.1:${port}`;
      const redirect = await fetch(base, { redirect: 'manual' });
      assert.equal(redirect.status, 302);
      assert.equal(redirect.headers.get('location'), '/students');
      const html = await (await fetch(`${base}/students`)).text();
      assert.ok(html.includes('<div id="root"></div>'));
      assert.ok(!html.includes('<tbody>'));
      const script = html.match(/<script[^>]*src="([^"]+)"/)[1];
      const asset = await fetch(`${base}${script}`);
      assert.equal(asset.status, 200);
      assert.match(asset.headers.get('content-type'), /javascript/);
      if (development) {
        const jsx = await fetch(`${base}/src/main.jsx`);
        assert.equal(jsx.status, 200);
        assert.ok((await jsx.text()).includes('createRoot'));
        const response = await fetch(`${base}/api/students`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Runtime test', email: 'runtime@example.com' }), redirect: 'manual'
        });
        assert.equal(response.status, 201);
        assert.equal(response.headers.get('location'), null);
        savedStudent = await response.json();
      }
      const students = await (await fetch(`${base}/api/students`)).json();
      assert.equal(students.length, seed.length + 1);
      assert.deepEqual(students.at(-1), savedStudent);
      const missing = await fetch(`${base}/api/missing`);
      assert.equal(missing.status, 404);
      assert.equal((await missing.json()).code, 'not_found');
      assert.equal((await fetch(`${base}/data/students.json`)).status, 404);
    } finally {
      child.kill();
      await exited;
      child.stdout.destroy();
      child.stderr.destroy();
    }
  }
});

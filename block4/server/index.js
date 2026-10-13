import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from './app.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const dataFile = process.env.DATA_FILE ? path.resolve(process.env.DATA_FILE) : path.join(root, 'data/students.json');
const app = createApp({ dataFile });
const development = process.argv.includes('--dev');
const port = Number(process.env.PORT || 3004);

if (development) {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root,
    server: { middlewareMode: true, fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', `${root.replaceAll('\\', '/')}data/**`] } },
    appType: 'custom'
  });
  app.use('/data', (req, res) => res.status(404).type('text').send('Không tìm thấy trang.'));
  app.use(vite.middlewares);
  app.get('/students', async (req, res) => {
    const template = await fs.readFile(path.join(root, 'index.html'), 'utf8');
    res.type('html').send(await vite.transformIndexHtml(req.originalUrl, template));
  });
} else {
  const html = path.join(root, 'dist/index.html');
  try {
    await fs.access(html);
  } catch {
    console.error('Chưa có bản build. Hãy chạy npm.cmd run build trước.');
    process.exit(1);
  }
  app.use(express.static(path.join(root, 'dist'), { index: false }));
  app.get('/students', (req, res) => res.sendFile(html));
}
app.use((req, res) => res.status(404).type('text').send('Không tìm thấy trang.'));
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).type('text').send('Không thể tải trang. Vui lòng thử lại.');
});
const server = app.listen(port, () => console.log(`Ứng dụng đang chạy tại http://localhost:${server.address().port}/students`));

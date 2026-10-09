const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { afterEach, beforeEach, test } = require('node:test');
const { createApp } = require('../src/app');
const { StudentStore } = require('../src/services/student-store');

let temporaryDirectory;
let dataFile;
let server;

const silentLogger = { error() {} };

beforeEach(async () => {
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'students-app-'));
  dataFile = path.join(temporaryDirectory, 'students.json');
  await fs.writeFile(dataFile, '[]\n', 'utf8');
});

afterEach(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = undefined;
  }

  await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

async function startApp(customDataFile = dataFile, options = {}) {
  const app = createApp({ dataFile: customDataFile, logger: silentLogger, ...options });
  server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
}

function request({ method = 'GET', route = '/', form } = {}) {
  const body = form ? new URLSearchParams(form).toString() : '';
  const address = server.address();

  return new Promise((resolve, reject) => {
    const outgoingRequest = http.request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path: route,
        method,
        headers: body
          ? {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(body)
            }
          : undefined
      },
      (response) => {
        let responseBody = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          responseBody += chunk;
        });
        response.on('end', () => {
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: responseBody
          });
        });
      }
    );

    outgoingRequest.on('error', reject);
    outgoingRequest.end(body);
  });
}

test('GET / chuyển hướng đến danh sách sinh viên', async () => {
  await startApp();
  const response = await request();

  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/students');
});

test('GET /students render form và trạng thái danh sách rỗng', async () => {
  await startApp();
  const response = await request({ route: '/students' });

  assert.equal(response.status, 200);
  assert.match(response.body, /action="\/students" method="post"/);
  assert.match(response.body, /Chưa có sinh viên nào/);
});

test('POST hợp lệ lưu dữ liệu, redirect 303 và GET không tạo thêm record', async () => {
  await startApp();
  const postResponse = await request({
    method: 'POST',
    route: '/students',
    form: { name: '  Nguyễn Văn An  ', email: '  an@example.com  ' }
  });

  assert.equal(postResponse.status, 303);
  assert.equal(postResponse.headers.location, '/students?status=created');

  const firstRead = JSON.parse(await fs.readFile(dataFile, 'utf8'));
  assert.deepEqual(firstRead, [
    { id: 1, name: 'Nguyễn Văn An', email: 'an@example.com' }
  ]);

  const getResponse = await request({ route: postResponse.headers.location });
  assert.equal(getResponse.status, 200);
  assert.match(getResponse.body, /Nguyễn Văn An/);
  assert.match(getResponse.body, /Đã thêm sinh viên thành công/);

  const secondRead = JSON.parse(await fs.readFile(dataFile, 'utf8'));
  assert.equal(secondRead.length, 1);
});

test('POST từ chối dữ liệu rỗng và email sai định dạng', async () => {
  await startApp();

  const emptyResponse = await request({
    method: 'POST',
    route: '/students',
    form: { name: '', email: '' }
  });
  assert.equal(emptyResponse.status, 303);
  assert.equal(emptyResponse.headers.location, '/students?error=required');

  const invalidEmailResponse = await request({
    method: 'POST',
    route: '/students',
    form: { name: 'Nguyễn Văn An', email: 'khong-phai-email' }
  });
  assert.equal(invalidEmailResponse.status, 303);
  assert.equal(invalidEmailResponse.headers.location, '/students?error=invalid_email');

  const students = JSON.parse(await fs.readFile(dataFile, 'utf8'));
  assert.deepEqual(students, []);
});

test('email trùng không phân biệt chữ hoa và chữ thường', async () => {
  await fs.writeFile(
    dataFile,
    JSON.stringify([{ id: 4, name: 'Sinh viên cũ', email: 'Student@Example.com' }]),
    'utf8'
  );
  await startApp();

  const response = await request({
    method: 'POST',
    route: '/students',
    form: { name: 'Sinh viên mới', email: 'student@example.com' }
  });

  assert.equal(response.status, 303);
  assert.equal(response.headers.location, '/students?error=duplicate_email');
  const students = JSON.parse(await fs.readFile(dataFile, 'utf8'));
  assert.equal(students.length, 1);
});

test('ID mới tăng từ ID lớn nhất và dữ liệu đọc được bởi app mới', async () => {
  await fs.writeFile(
    dataFile,
    JSON.stringify([
      { id: 2, name: 'A', email: 'a@example.com' },
      { id: 7, name: 'B', email: 'b@example.com' }
    ]),
    'utf8'
  );

  const store = new StudentStore(dataFile);
  const created = await store.create({ name: 'C', email: 'c@example.com' });
  assert.equal(created.id, 8);

  await startApp();
  const response = await request({ route: '/students' });
  assert.equal(response.status, 200);
  assert.match(response.body, /c@example\.com/);
});

test('các lần ghi đồng thời được tuần tự hóa và không trùng ID', async () => {
  const store = new StudentStore(dataFile);

  await Promise.all([
    store.create({ name: 'A', email: 'a@example.com' }),
    store.create({ name: 'B', email: 'b@example.com' }),
    store.create({ name: 'C', email: 'c@example.com' })
  ]);

  const students = JSON.parse(await fs.readFile(dataFile, 'utf8'));
  assert.deepEqual(
    students.map((student) => student.id),
    [1, 2, 3]
  );
});

test('HTML escape dữ liệu sinh viên trước khi hiển thị', async () => {
  await fs.writeFile(
    dataFile,
    JSON.stringify([
      { id: 1, name: '<script>alert("xss")</script>', email: 'safe@example.com' }
    ]),
    'utf8'
  );
  await startApp();

  const response = await request({ route: '/students' });

  assert.equal(response.status, 200);
  assert.doesNotMatch(response.body, /<script>alert/);
  assert.match(response.body, /&lt;script&gt;alert/);
});

test('file JSON hỏng trả về trang lỗi thân thiện', async () => {
  await fs.writeFile(dataFile, '{JSON hỏng', 'utf8');
  await startApp();

  const response = await request({ route: '/students' });

  assert.equal(response.status, 500);
  assert.match(response.body, /Không thể đọc hoặc lưu dữ liệu sinh viên/);
});

test('lỗi ghi dữ liệu trả về trang lỗi thân thiện', async () => {
  const failingStore = {
    async getAll() {
      return [];
    },
    async create() {
      throw new Error('Không thể ghi file');
    }
  };
  await startApp(dataFile, { store: failingStore });

  const response = await request({
    method: 'POST',
    route: '/students',
    form: { name: 'Nguyễn Văn An', email: 'an@example.com' }
  });

  assert.equal(response.status, 500);
  assert.match(response.body, /Không thể đọc hoặc lưu dữ liệu sinh viên/);
});

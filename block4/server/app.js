import express from 'express';
import { StudentStore, DuplicateStudentEmailError } from './student-store.js';
import { validateStudentInput } from '../shared/validation.js';

export function createApp({ dataFile, store = new StudentStore(dataFile), logger = console } = {}) {
  const app = express();
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', express.json({ limit: '16kb' }));
  app.get('/api/students', async (req, res) => res.json(await store.getAll()));
  app.post('/api/students', async (req, res) => {
    const validation = validateStudentInput(req.body);
    if (!validation.student) return res.status(400).json(validation);
    try {
      res.status(201).json(await store.create(validation.student));
    } catch (error) {
      if (error instanceof DuplicateStudentEmailError) {
        return res.status(409).json({ code: 'duplicate_email', message: error.message });
      }
      throw error;
    }
  });
  app.use('/api', (req, res) => res.status(404).json({ code: 'not_found', message: 'API không tồn tại.' }));
  app.use('/api', (error, req, res, next) => {
    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
      return res.status(400).json({ code: 'invalid_body', message: 'Nội dung yêu cầu JSON không hợp lệ hoặc quá lớn.' });
    }
    logger.error(error);
    res.status(500).json({ code: 'storage_error', message: 'Không thể đọc hoặc lưu dữ liệu sinh viên. Vui lòng thử lại.' });
  });
  app.get('/', (req, res) => res.redirect('/students'));
  return app;
}

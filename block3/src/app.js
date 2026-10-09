const path = require('node:path');
const express = require('express');
const { createStudentsRouter } = require('./routes/students');
const { StudentStore } = require('./services/student-store');

function createApp(options = {}) {
  const app = express();
  const dataFile = options.dataFile || path.join(__dirname, '..', 'data', 'students.json');
  const logger = options.logger || console;
  const store = options.store || new StudentStore(dataFile);

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));

  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/', (request, response) => {
    response.redirect('/students');
  });

  app.use('/students', createStudentsRouter(store));

  app.use((request, response) => {
    response.status(404).render('error', {
      pageTitle: 'Không tìm thấy trang',
      heading: 'Không tìm thấy trang',
      message: 'Đường dẫn bạn yêu cầu không tồn tại.'
    });
  });

  app.use((error, request, response, next) => {
    logger.error(error);

    if (response.headersSent) {
      return next(error);
    }

    return response.status(500).render('error', {
      pageTitle: 'Lỗi hệ thống',
      heading: 'Không thể xử lý yêu cầu',
      message: 'Không thể đọc hoặc lưu dữ liệu sinh viên. Vui lòng thử lại sau.'
    });
  });

  return app;
}

module.exports = { createApp };

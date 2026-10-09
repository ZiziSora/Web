const express = require('express');
const { createStudentController } = require('../controllers/student-controller');

function createStudentsRouter(store) {
  const router = express.Router();
  const controller = createStudentController(store);

  router.get('/', controller.index);
  router.post('/', controller.create);

  return router;
}

module.exports = { createStudentsRouter };

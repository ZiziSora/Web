const { validateStudentInput } = require('../validators/student-validator');
const { DuplicateStudentEmailError } = require('../services/student-store');

const STATUS_MESSAGES = {
  created: 'Đã thêm sinh viên thành công.'
};

const ERROR_MESSAGES = {
  required: 'Vui lòng nhập đầy đủ họ tên và email.',
  invalid_email: 'Email không đúng định dạng.',
  too_long: 'Họ tên hoặc email vượt quá độ dài cho phép.',
  duplicate_email: 'Email này đã tồn tại trong danh sách.'
};

function createStudentController(store) {
  return {
    async index(request, response, next) {
      try {
        const students = await store.getAll();

        response.render('students/index', {
          pageTitle: 'Quản lý sinh viên',
          students,
          successMessage: STATUS_MESSAGES[request.query.status] || null,
          errorMessage: ERROR_MESSAGES[request.query.error] || null
        });
      } catch (error) {
        next(error);
      }
    },

    async create(request, response, next) {
      const validation = validateStudentInput(request.body);

      if (!validation.valid) {
        return response.redirect(303, `/students?error=${validation.errorCode}`);
      }

      try {
        await store.create(validation.student);
        return response.redirect(303, '/students?status=created');
      } catch (error) {
        if (error instanceof DuplicateStudentEmailError) {
          return response.redirect(303, '/students?error=duplicate_email');
        }

        return next(error);
      }
    }
  };
}

module.exports = { createStudentController };

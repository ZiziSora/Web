const fs = require('node:fs/promises');
const path = require('node:path');

class DuplicateStudentEmailError extends Error {
  constructor(email) {
    super(`Email đã tồn tại: ${email}`);
    this.name = 'DuplicateStudentEmailError';
  }
}

class StudentStore {
  constructor(dataFile) {
    this.dataFile = dataFile;
    this.writeQueue = Promise.resolve();
  }

  async getAll() {
    return this.readStudents();
  }

  create(studentInput) {
    const operation = this.writeQueue
      .catch(() => undefined)
      .then(() => this.createAndSave(studentInput));

    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  async createAndSave(studentInput) {
    const students = await this.readStudents();
    const normalizedEmail = studentInput.email.toLocaleLowerCase();
    const emailExists = students.some(
      (student) => String(student.email).toLocaleLowerCase() === normalizedEmail
    );

    if (emailExists) {
      throw new DuplicateStudentEmailError(studentInput.email);
    }

    const maxId = students.reduce((currentMax, student) => {
      const id = Number.isInteger(student.id) ? student.id : 0;
      return Math.max(currentMax, id);
    }, 0);

    const student = {
      id: maxId + 1,
      name: studentInput.name,
      email: studentInput.email
    };

    await this.writeStudents([...students, student]);
    return student;
  }

  async readStudents() {
    let content;

    try {
      content = await fs.readFile(this.dataFile, 'utf8');
    } catch (error) {
      throw new Error(`Không thể đọc file dữ liệu: ${this.dataFile}`, { cause: error });
    }

    try {
      const students = JSON.parse(content);

      if (!Array.isArray(students)) {
        throw new TypeError('Dữ liệu sinh viên phải là một mảng JSON.');
      }

      return students;
    } catch (error) {
      throw new Error(`File dữ liệu không chứa JSON hợp lệ: ${this.dataFile}`, { cause: error });
    }
  }

  async writeStudents(students) {
    const directory = path.dirname(this.dataFile);
    const temporaryFile = `${this.dataFile}.${process.pid}.${Date.now()}.tmp`;

    try {
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(temporaryFile, `${JSON.stringify(students, null, 2)}\n`, 'utf8');
      await fs.rename(temporaryFile, this.dataFile);
    } catch (error) {
      await fs.rm(temporaryFile, { force: true }).catch(() => undefined);
      throw new Error(`Không thể lưu file dữ liệu: ${this.dataFile}`, { cause: error });
    }
  }
}

module.exports = { StudentStore, DuplicateStudentEmailError };

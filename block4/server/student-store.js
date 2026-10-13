import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export class DuplicateStudentEmailError extends Error {}

export class StudentStore {
  constructor(dataFile) {
    this.dataFile = dataFile;
    this.writeQueue = Promise.resolve();
  }

  async getAll() {
    const students = JSON.parse(await fs.readFile(this.dataFile, 'utf8'));
    if (!Array.isArray(students) || students.some(student =>
      !Number.isSafeInteger(student?.id) || student.id < 1 ||
      typeof student.name !== 'string' || typeof student.email !== 'string'
    ) || new Set(students.map(student => student.id)).size !== students.length) {
      throw new Error('File dữ liệu sinh viên không hợp lệ.');
    }
    return students;
  }

  create(input) {
    const operation = this.writeQueue.then(async () => {
      const students = await this.getAll();
      if (students.some(student => student.email.toLowerCase() === input.email.toLowerCase())) {
        throw new DuplicateStudentEmailError('Email này đã tồn tại trong danh sách.');
      }
      const id = students.reduce((max, student) => Math.max(max, student.id), 0) + 1;
      if (!Number.isSafeInteger(id)) throw new Error('Không thể tạo ID mới.');
      const student = { id, ...input };
      const temporaryFile = `${this.dataFile}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporaryFile, `${JSON.stringify([...students, student], null, 2)}\n`, 'utf8');
        await fs.rename(temporaryFile, this.dataFile);
      } finally {
        await fs.rm(temporaryFile, { force: true }).catch(() => {});
      }
      return student;
    });
    this.writeQueue = operation.catch(() => {});
    return operation;
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateStudentInput(input = {}) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim() : '';

  if (!name || !email) {
    return { valid: false, errorCode: 'required' };
  }

  if (name.length > 100 || email.length > 254) {
    return { valid: false, errorCode: 'too_long' };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { valid: false, errorCode: 'invalid_email' };
  }

  return {
    valid: true,
    student: { name, email }
  };
}

module.exports = { validateStudentInput };

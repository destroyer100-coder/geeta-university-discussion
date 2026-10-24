const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isEmail = (value) => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const validateRegister = (data) => {
  if (!isPlainObject(data)) return 'A valid request body is required.';
  if (typeof data.name !== 'string' || data.name.trim().length < 2 || data.name.trim().length > 100) {
    return 'Name must be between 2 and 100 characters.';
  }
  if (!isEmail(data.email)) return 'A valid email address is required.';
  if (typeof data.password !== 'string' || data.password.length < 8 || data.password.length > 128) {
    return 'Password must be between 8 and 128 characters.';
  }
  if (data.department !== undefined && (typeof data.department !== 'string' || data.department.length > 120)) {
    return 'Department must be 120 characters or fewer.';
  }
  if (data.year !== undefined && (typeof data.year !== 'string' || data.year.length > 40)) {
    return 'Year must be 40 characters or fewer.';
  }
  return null;
};

export const validateLogin = (data) => {
  if (!isPlainObject(data)) return 'A valid request body is required.';
  if (!isEmail(data.email)) return 'A valid email address is required.';
  if (typeof data.password !== 'string' || data.password.length < 1 || data.password.length > 128) {
    return 'Password is required.';
  }
  return null;
};

export const validateEmailVerification = (data) => {
  if (!isPlainObject(data) || !isEmail(data.email)) return 'A valid email address is required.';
  if (typeof data.token !== 'string' || !/^[a-f0-9]{64}$/i.test(data.token)) {
    return 'A valid verification token is required.';
  }
  return null;
};

export const validateResendVerification = (data) => {
  if (!isPlainObject(data) || !isEmail(data.email)) return 'A valid email address is required.';
  return null;
};

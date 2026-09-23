const bcrypt = require('bcryptjs');
const { insertUser, findUserByUsername } = require('./db');

const allowedRoles = new Set(['admin', 'guardia']);

async function createUser({ username, password, rol }) {
  if (!username || !password || !rol) {
    const error = new Error('username, password y rol son obligatorios.');
    error.code = 'VALIDATION_ERROR';
    error.status = 422;
    error.fields = ['username', 'password', 'rol'];
    throw error;
  }

  if (!allowedRoles.has(rol)) {
    const error = new Error('El rol debe ser admin o guardia.');
    error.code = 'INVALID_ROLE';
    error.status = 422;
    error.fields = ['rol'];
    throw error;
  }

  if (findUserByUsername(username)) {
    const error = new Error('El username ya está registrado.');
    error.code = 'USERNAME_TAKEN';
    error.status = 409;
    error.fields = ['username'];
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  insertUser({ username, passwordHash, rol });
  return { username, rol };
}

module.exports = { createUser };
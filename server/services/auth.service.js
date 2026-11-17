import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import validator from 'validator';
import { userRepository } from '../repositories/user.repository.js';
import { categoryRepository } from '../repositories/category.repository.js';
import { accountRepository } from '../repositories/account.repository.js';
import { AppError } from '../utils/errors.js';
import { now } from '../utils/helpers.js';
import { JWT_SECRET } from '../middleware/auth.middleware.js';

const EMAIL_TTL_LIMIT = 5000 * 60; // 5 min (demo)

const signToken = (user) =>
  jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: `${user.firstName} ${user.lastName}` },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

const sanitize = (user) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt
});

export const authService = {
  async register({ firstName, lastName, email, password }) {
    const fName = validator.trim(firstName || '');
    const lName = validator.trim(lastName || '');
    const mail = validator.normalizeEmail(String(email || '').toLowerCase(), {
      all_lowercase: true
    });

    if (!fName || !lName) throw new AppError(400, 'Nombre y apellido son obligatorios.');
    if (!validator.isEmail(String(mail || ''))) throw new AppError(400, 'Correo electrónico inválido.');
    if (!validator.isLength(password || '', { min: 8 })) {
      throw new AppError(400, 'La contraseña debe tener al menos 8 caracteres.');
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw new AppError(400, 'La contraseña debe contener letras y números.');
    }
    if (await userRepository.findByEmail(mail)) {
      throw new AppError(409, 'Ya existe una cuenta con este correo.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userRepository.create({ firstName: fName, lastName: lName, email: mail, passwordHash, role: 'user' });

    // Datos de inicio mínimos para el usuario (categorías y cuenta por defecto).
    await this.bootstrap(user.id);

    return { user: sanitize(user), token: signToken(user) };
  },

  async bootstrap(userId) {
    const defaults = [
      { name: 'Salario', type: 'income', color: '#C7F13A' },
      { name: 'Freelance', type: 'income', color: '#9DD102' },
      { name: 'Inversiones', type: 'income', color: '#D9D9D9' },
      { name: 'Vivienda', type: 'expense', color: '#2B2B2B' },
      { name: 'Alimentación', type: 'expense', color: '#C7F13A' },
      { name: 'Transporte', type: 'expense', color: '#7A7A7A' },
      { name: 'Ocio', type: 'expense', color: '#F5F5F5' },
      { name: 'Salud', type: 'expense', color: '#D9D9D9' },
      { name: 'Educación', type: 'expense', color: '#9DD102' },
      { name: 'Otros gastos', type: 'expense', color: '#555555' }
    ];
    for (const c of defaults) {
      await categoryRepository.create({ ...c, userId });
    }
    const acc = await accountRepository.create({ userId, name: 'Efectivo', type: 'cash', initialBalance: 0 });
    await accountRepository.setDefault(userId, acc.id);
  },

  async login({ email, password }) {
    const mail = validator.normalizeEmail(String(email || '').toLowerCase(), { all_lowercase: true });
    if (!validator.isEmail(String(mail || ''))) throw new AppError(400, 'Credenciales inválidas.');

    const user = await userRepository.findWithPasswordByEmail(mail);
    if (!user) throw new AppError(401, 'Credenciales inválidas.');
    const ok = await bcrypt.compare(String(password || ''), user.passwordHash);
    if (!ok) throw new AppError(401, 'Credenciales inválidas.');

    return { user: sanitize(user), token: signToken(user) };
  },

  /** Demo SaaS: al no contar con servidor SMTP, la recuperación devuelve el token. */
  async requestPasswordReset({ email }) {
    const mail = validator.normalizeEmail(String(email || '').toLowerCase(), { all_lowercase: true });
    if (!validator.isEmail(String(mail || ''))) throw new AppError(400, 'Correo inválido.');
    const user = await userRepository.findByEmail(mail);
    if (!user) throw new AppError(404, 'No existe una cuenta con este correo.');
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + EMAIL_TTL_LIMIT).toISOString();
    await userRepository.saveResetToken({ token, userId: user.id, expiresAt });
    return { message: 'Enlace de recuperación generado.', token, expiresAt, devOnly: true };
  },

  async verifyResetToken({ token }) {
    if (!token) throw new AppError(400, 'URL de recuperación inválida.');
    const record = await userRepository.findValidResetToken(token);
    if (!record) throw new AppError(400, 'El enlace expiró o ya fue utilizado.');
    return { valid: true, token };
  },

  async resetPassword({ token, password }) {
    const record = await userRepository.findValidResetToken(token);
    if (!record) throw new AppError(400, 'El enlace expiró o ya fue utilizado.');
    if (!validator.isLength(String(password || ''), { min: 8 })) {
      throw new AppError(400, 'La contraseña debe tener al menos 8 caracteres.');
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw new AppError(400, 'La contraseña debe contener letras y números.');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await userRepository.update(record.userId, { passwordHash });
    await userRepository.markResetTokenUsed(token);
    return { message: 'Contraseña actualizada correctamente.' };
  },

  async me(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError(401, 'Usuario no encontrado.');
    return user;
  }
};

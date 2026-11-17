import bcrypt from 'bcryptjs';
import validator from 'validator';
import { userRepository } from '../repositories/user.repository.js';
import { AppError } from '../utils/errors.js';

export const userService = {
  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError(404, 'Usuario no encontrado.');
    return user;
  },

  async updateProfile(userId, { firstName, lastName, currentPassword, newPassword }) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError(404, 'Usuario no encontrado.');

    const fields = {};
    if (firstName !== undefined) {
      if (!validator.trim(firstName)) throw new AppError(400, 'El nombre no puede estar vacío.');
      fields.firstName = validator.trim(firstName);
    }
    if (lastName !== undefined) {
      if (!validator.trim(lastName)) throw new AppError(400, 'El apellido no puede estar vacío.');
      fields.lastName = validator.trim(lastName);
    }

    if (newPassword) {
      if (!currentPassword) throw new AppError(400, 'Debe ingresar su contraseña actual.');
      const stored = await userRepository.findWithPasswordByEmail(user.email);
      const ok = bcrypt.compareSync(String(currentPassword), stored.passwordHash);
      if (!ok) throw new AppError(400, 'La contraseña actual es incorrecta.');
      if (!validator.isLength(String(newPassword), { min: 8 })) {
        throw new AppError(400, 'La nueva contraseña debe tener al menos 8 caracteres.');
      }
      if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
        throw new AppError(400, 'La nueva contraseña debe contener letras y números.');
      }
      fields.passwordHash = bcrypt.hashSync(newPassword, 10);
    }

    return userRepository.update(userId, fields);
  }
};

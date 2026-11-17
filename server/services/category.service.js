import validator from 'validator';
import { categoryRepository } from '../repositories/category.repository.js';
import { AppError } from '../utils/errors.js';

const TYPES = ['income', 'expense'];
const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

const cleanName = (name) => validator.trim(String(name || ''));
const cleanType = (type) => String(type || '').toLowerCase();

const canManage = (category, user) => {
  if (!category) return false;
  if (category.isSystem) return user.role === 'admin';
  return category.userId === user.id;
};

export const categoryService = {
  async list(user, { type }) {
    return categoryRepository.listVisible(user.id, TYPES.includes(type) ? type : null);
  },

  async create(user, { name, type, color }) {
    const cleanedName = cleanName(name);
    const cleanedType = cleanType(type);
    if (!cleanedName) throw new AppError(400, 'El nombre de la categoría es obligatorio.');
    if (!TYPES.includes(cleanedType)) throw new AppError(400, 'Tipo inválido (income | expense).');
    if (color && !COLOR_RE.test(color)) throw new AppError(400, 'Color inválido. Use formato #RRGGBB.');

    const visible = await categoryRepository.listVisible(user.id, cleanedType);
    if (visible.find((c) => c.name.toLowerCase() === cleanedName.toLowerCase())) {
      throw new AppError(409, 'Ya existe una categoría con ese nombre.');
    }

    return categoryRepository.create({ userId: user.id, name: cleanedName, type: cleanedType, color: color || '#C7F13A' });
  },

  async update(user, id, { name, color }) {
    const category = await categoryRepository.findById(id);
    if (!canManage(category, user)) throw new AppError(403, 'No tiene permisos sobre esta categoría.');

    if (name !== undefined) {
      const cleanedName = cleanName(name);
      if (!cleanedName) throw new AppError(400, 'El nombre de la categoría es obligatorio.');
      const visible = await categoryRepository.listVisible(user.id, category.type);
      if (visible.find((c) => c.id !== id && c.name.toLowerCase() === cleanedName.toLowerCase())) {
        throw new AppError(409, 'Ya existe una categoría con ese nombre.');
      }
    }
    if (color !== undefined && color !== null && color !== '' && !COLOR_RE.test(color)) {
      throw new AppError(400, 'Color inválido. Use formato #RRGGBB.');
    }

    return categoryRepository.update(id, { name, color });
  },

  async remove(user, id) {
    const category = await categoryRepository.findById(id);
    if (!canManage(category, user)) throw new AppError(403, 'No tiene permisos sobre esta categoría.');
    await categoryRepository.remove(id); // equivalente a los FK ON DELETE SET NULL / CASCADE
    return { message: 'Categoría eliminada.' };
  }
};

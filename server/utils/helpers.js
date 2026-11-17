import { v4 as uuidv4 } from 'uuid';

export const genId = () => uuidv4();

export const now = () => new Date().toISOString();

export const assertOwner = (entity, userId, message = 'Recurso no encontrado o sin acceso') => {
  if (!entity || entity.userId !== userId) {
    const err = new Error(message);
    err.status = 404;
    throw err;
  }
};
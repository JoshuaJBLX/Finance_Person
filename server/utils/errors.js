export class AppError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
    this.isOperational = true;
  }
}

export const asApiError = (raw) => {
  if (raw instanceof AppError) return raw;
  if (raw && raw.name === 'UnauthorizedError') {
    return new AppError(401, 'No autorizado. Sesión inválida o expirada.');
  }
  return new AppError(500, 'Error interno del servidor');
};
import { asApiError } from '../utils/errors.js';

export const notFound = (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
};

export const errorHandler = (err, req, res, next) => {
  const apiError = asApiError(err);
  if (apiError.status >= 500) {
    console.error('Unhandled error:', err);
  }
  res.status(apiError.status).json({
    error: apiError.message,
    ...(apiError.details ? { details: apiError.details } : {})
  });
};

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
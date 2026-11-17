import { expressjwt } from 'express-jwt';
import { AppError } from '../utils/errors.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'finance-person-dev-secret-change-in-prod';

export const authenticate = expressjwt({
  secret: JWT_SECRET,
  algorithms: ['HS256'],
  requestProperty: 'auth'
});

export const requireRole = (...roles) => (req, res, next) => {
  const role = req.auth?.role;
  if (!role || !roles.includes(role)) {
    return next(new AppError(403, 'No tiene permisos para realizar esta acción.'));
  }
  next();
};
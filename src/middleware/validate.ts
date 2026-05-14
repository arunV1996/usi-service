import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export default function validate(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    next();
    return;
  }
  res.status(400).json({
    status: 'FAIL',
    error: {
      code: 'VALIDATION_FAILED',
      message: 'Request validation failed',
      details: errors.array().map((e) => ({ field: (e as { path?: string }).path, message: e.msg })),
    },
  });
}

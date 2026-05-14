import type { Request, Response, NextFunction } from 'express';
import { get as getLogger } from '../helpers/logger';

export class HttpError extends Error {
  status: number;
  code: string;
  details: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({
    status: 'FAIL',
    error: { code: 'NOT_FOUND', message: 'Resource not found' },
  });
}

// Express needs the 4-arg signature to recognise this as an error handler.
export function errorHandler(err: Error & Partial<HttpError>, req: Request, res: Response, _next: NextFunction): void {
  const log = getLogger();
  const status = err.status || 500;
  const code = err.code || (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');

  if (status >= 500) {
    log.error('unhandled_error', {
      correlation_id: req.correlationId,
      message: err.message,
      stack: err.stack,
    });
  } else {
    log.warn('handled_error', {
      correlation_id: req.correlationId,
      status,
      code,
      message: err.message,
    });
  }

  res.status(status).json({
    status: 'FAIL',
    error: {
      code,
      message: status >= 500 ? 'Internal server error' : err.message || 'Request failed',
      details: status >= 500 ? undefined : err.details,
      correlation_id: req.correlationId,
    },
  });
}

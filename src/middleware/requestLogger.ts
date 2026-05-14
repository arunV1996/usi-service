import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { redact } from '../helpers/redact';
import { get as getLogger } from '../helpers/logger';

function onFinished(res: Response, cb: () => void): void {
  res.once('finish', cb);
  res.once('close', cb);
}

/**
 * Logs every incoming request with redaction. Sensitive fields are stripped
 * by the redactor and the logger format.
 */
export default function requestLogger(): RequestHandler {
  return function (req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    const log = getLogger();

    onFinished(res, () => {
      const durMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
      const meta = {
        type: 'http_request',
        correlation_id: req.correlationId,
        method: req.method,
        path: req.route ? req.baseUrl + (req.route.path as string) : req.path,
        status: res.statusCode,
        duration_ms: durMs,
        client_id: req.auth ? req.auth.clientId : null,
        ua: req.get('user-agent') || null,
        ip: req.ip,
        body: req.body ? redact(req.body) : undefined,
        params: req.params && Object.keys(req.params).length ? redact(req.params) : undefined,
      };
      if (res.statusCode >= 500) log.error('request_completed', meta);
      else if (res.statusCode >= 400) log.warn('request_completed', meta);
      else log.info('request_completed', meta);
    });
    next();
  };
}

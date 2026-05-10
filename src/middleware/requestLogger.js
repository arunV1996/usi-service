'use strict';

const onFinished = (res, cb) => {
  res.once('finish', cb);
  res.once('close', cb);
};

const { redact } = require('../helpers/redact');
const { get: getLogger } = require('../helpers/logger');

/**
 * Logs every incoming request with redaction. Sensitive fields (auth headers,
 * passwords, account numbers, scans, base URLs, etc.) are redacted by the
 * logger format. Body is shallow-copied and re-redacted at this layer too.
 */
module.exports = function requestLogger() {
  return function (req, res, next) {
    const start = process.hrtime.bigint();
    const log = getLogger();

    onFinished(res, () => {
      const durMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
      const meta = {
        type: 'http_request',
        correlation_id: req.correlationId,
        method: req.method,
        // path only; never log query string in case of leakage of identifiers.
        path: req.route ? req.baseUrl + req.route.path : req.path,
        status: res.statusCode,
        duration_ms: durMs,
        request_id: req.id,
        client_id: req.auth ? req.auth.clientId : null,
        ua: req.get('user-agent') || null,
        ip: req.ip,
        // Bodies redacted defensively. Keys like password, pin, account_number
        // are stripped by the redactor.
        body: req.body ? redact(req.body) : undefined,
        params: req.params && Object.keys(req.params).length ? redact(req.params) : undefined,
      };
      if (res.statusCode >= 500) log.error('request_completed', meta);
      else if (res.statusCode >= 400) log.warn('request_completed', meta);
      else log.info('request_completed', meta);
    });
    next();
  };
};

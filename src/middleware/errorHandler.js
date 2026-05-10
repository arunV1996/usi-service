'use strict';

const { get: getLogger } = require('../helpers/logger');

class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function notFound(req, res) {
  res.status(404).json({
    status: 'FAIL',
    error: { code: 'NOT_FOUND', message: 'Resource not found' },
  });
}

// Express needs the 4-arg signature to recognise this as an error handler.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
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

  // Never leak internal error details to clients in production.
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

module.exports = { HttpError, notFound, errorHandler };

'use strict';

const { randomId } = require('../helpers/crypto');

const HEADER = 'x-correlation-id';

module.exports = function correlation(req, res, next) {
  const incoming = req.header(HEADER);
  const id = (incoming && /^[A-Za-z0-9._-]{8,128}$/.test(incoming)) ? incoming : randomId(12);
  req.correlationId = id;
  res.setHeader(HEADER, id);
  next();
};

'use strict';

const auditStore = require('../helpers/auditStore');

exports.list = async (req, res, next) => {
  try {
    const items = await auditStore.query({
      correlationId: req.query.correlation_id,
      operation: req.query.operation,
      upstreamStatus: req.query.upstream_status,
      fromDate: req.query.from,
      toDate: req.query.to,
      limit: req.query.limit,
      includeBodies: false,
    });
    res.json({ status: 'SUCCESS', data: { count: items.length, items } });
  } catch (e) { next(e); }
};

exports.detail = async (req, res, next) => {
  try {
    const items = await auditStore.query({ id: req.params.id, includeBodies: true });
    if (!items.length) return res.status(404).json({
      status: 'FAIL',
      error: { code: 'NOT_FOUND', message: 'Audit entry not found' },
    });
    res.json({ status: 'SUCCESS', data: items[0] });
  } catch (e) { next(e); }
};

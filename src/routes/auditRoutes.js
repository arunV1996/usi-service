'use strict';

const router = require('express').Router();
const { query, param } = require('express-validator');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/auditController');

router.get('/external-calls',
  query('limit').optional().isInt({ min: 1, max: 500 }),
  query('correlation_id').optional().isString().isLength({ max: 128 }),
  query('operation').optional().isString().isLength({ max: 80 }),
  query('upstream_status').optional().isIn(['SUCCESS', 'FAIL']),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  validate,
  ctrl.list,
);

router.get('/external-calls/:id',
  param('id').isString().notEmpty().isLength({ max: 64 }),
  validate,
  ctrl.detail,
);

module.exports = router;

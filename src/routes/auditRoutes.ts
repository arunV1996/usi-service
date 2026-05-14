import { Router } from 'express';
import { query, param } from 'express-validator';
import validate from '../middleware/validate';
import * as ctrl from '../controllers/auditController';

const router = Router();

router.get(
  '/external-calls',
  query('limit').optional().isInt({ min: 1, max: 500 }),
  query('correlation_id').optional().isString().isLength({ max: 128 }),
  query('operation').optional().isString().isLength({ max: 80 }),
  query('upstream_status').optional().isIn(['SUCCESS', 'FAIL']),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  validate,
  ctrl.list,
);

router.get(
  '/external-calls/:id',
  param('id').isString().notEmpty().isLength({ max: 64 }),
  validate,
  ctrl.detail,
);

export default router;

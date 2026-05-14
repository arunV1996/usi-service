import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate';
import * as ctrl from '../controllers/ratesController';

const router = Router();

router.post(
  '/',
  body('dest_country').isString().trim().notEmpty().isLength({ max: 80 }),
  body('source_currency').optional().isString().isLength({ max: 8 }),
  body('dest_currency').optional().isString().isLength({ max: 8 }),
  body('delivery_bank').optional().isString().isLength({ max: 80 }),
  validate,
  ctrl.getRates,
);

export default router;

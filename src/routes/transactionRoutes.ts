import { Router } from 'express';
import { body, param } from 'express-validator';
import validate from '../middleware/validate';
import * as ctrl from '../controllers/transactionController';

const router = Router();

router.post(
  '/',
  body('remitter_id').isInt({ min: 1 }),
  body('beneficiary_id').isInt({ min: 1 }),
  body('destination_country').isString().notEmpty().isLength({ max: 80 }),
  body('agent_trans_ref').isString().notEmpty().isLength({ max: 64 }),
  body('trans_type').isIn(['Account', 'Cash Collection', 'Mobile Transfer', 'Card Transfer', 'Home Delivery']),
  body('purpose').isString().notEmpty(),
  body('source_of_income').isString().notEmpty(),
  body('payment_method').isString().notEmpty(),
  body('service_level').isString().notEmpty(),
  body('sms_confirmation').isIn(['t', 'f']),
  body('sms_notification').isIn(['t', 'f']),
  body('amount_type').equals('DESTINATION'),
  body('amount_to_send').isFloat({ gt: 0 }),
  body('source_currency').optional().isString().isLength({ max: 8 }),
  body('dest_currency').optional().isString().isLength({ max: 8 }),
  validate,
  ctrl.create,
);

router.post(
  '/confirm',
  body('trans_session_id').isString().notEmpty().isLength({ max: 32 }),
  validate,
  ctrl.confirm,
);

router.get(
  '/status/:trans_ref',
  param('trans_ref').isString().notEmpty().isLength({ max: 64 }),
  validate,
  ctrl.statusByTransRef,
);

router.get(
  '/status/by-agent-ref/:agent_trans_ref',
  param('agent_trans_ref').isString().notEmpty().isLength({ max: 64 }),
  validate,
  ctrl.statusByAgentRef,
);

router.post(
  '/charges',
  body('destination_country').isString().notEmpty(),
  body('trans_type').isString().notEmpty(),
  body('payment_method').isString().notEmpty(),
  body('service_level').isString().notEmpty(),
  body('sms_confirmation').isIn(['t', 'f']),
  body('sms_notification').isIn(['t', 'f']),
  body('amount_type').equals('DESTINATION'),
  body('amount_to_send').isFloat({ gt: 0 }),
  validate,
  ctrl.charges,
);

export default router;

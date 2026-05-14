import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate';
import * as ctrl from '../controllers/beneficiaryController';

const router = Router();

router.post('/account-types', ctrl.getAccountTypes);

router.post(
  '/',
  body('fname').isString().trim().notEmpty().isLength({ max: 80 }),
  body('lname').isString().trim().notEmpty().isLength({ max: 80 }),
  body('organisation_type').isIn(['INDIVIDUAL', 'CORPORATE']),
  body('address1').isString().notEmpty().isLength({ max: 200 }),
  body('city').isString().notEmpty().isLength({ max: 80 }),
  body('country').isString().notEmpty().isLength({ max: 80 }),
  body('mobile').isString().matches(/^[+0-9 ()-]{6,20}$/),
  body('linked_member_id').isInt({ min: 1 }),
  body('email').optional().isEmail(),
  body('account_number').optional().isString().isLength({ max: 64 }),
  body('benef_bank_iban').optional().isString().isLength({ max: 40 }),
  body('benef_bank_swift_code').optional().isString().isLength({ max: 16 }),
  body('benef_bank_ifsc_code').optional().isString().isLength({ max: 16 }),
  validate,
  ctrl.create,
);

router.post(
  '/search',
  body('linked_remitter_id').optional().isInt({ min: 1 }),
  body('beneficiary_id').optional().isInt({ min: 1 }),
  body('country').optional().isString().isLength({ max: 80 }),
  validate,
  ctrl.search,
);

router.put(
  '/:beneficiary_id',
  body('country').optional().isString().isLength({ max: 80 }),
  body('email').optional().isEmail(),
  validate,
  (req: Request, _res: Response, next: NextFunction) => {
    req.body.beneficiary_id = req.params.beneficiary_id;
    next();
  },
  ctrl.update,
);

export default router;

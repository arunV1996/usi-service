import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate';
import * as ctrl from '../controllers/remitterController';

const router = Router();

router.post(
  '/',
  body('firstname').isString().trim().isLength({ min: 1, max: 80 }),
  body('lastname').isString().trim().isLength({ min: 1, max: 80 }),
  body('type').isIn(['registered']),
  body('nationality').isString().isLength({ min: 2, max: 2 }),
  body('gender').isIn(['Male', 'Female', 'Unspecified']),
  body('status').isIn(['valid', 'expired', 'blocked']),
  body('address1').isString().notEmpty().isLength({ max: 200 }),
  body('city').isString().notEmpty().isLength({ max: 80 }),
  body('postcode').isString().notEmpty().isLength({ max: 20 }),
  body('mobile').isString().matches(/^[+0-9 ()-]{6,20}$/),
  body('dob').isISO8601(),
  body('id_type').isString().notEmpty(),
  body('id_details').isString().notEmpty().isLength({ max: 80 }),
  body('id_expiry').isISO8601(),
  body('orgtype').isIn(['Individual', 'Corporate']),
  body('company_name').optional().isString().isLength({ max: 120 }),
  body('company_reg_no').optional().isString().isLength({ max: 80 }),
  validate,
  ctrl.create,
);

router.post(
  '/search',
  body('remitter_id').optional().isString().isLength({ max: 40 }),
  body('firstname').optional().isString().isLength({ max: 80 }),
  body('lastname').optional().isString().isLength({ max: 80 }),
  body('mobile').optional().isString().isLength({ max: 20 }),
  body('id1_details').optional().isString().isLength({ max: 80 }),
  validate,
  ctrl.search,
);

router.put(
  '/:remitter_id',
  body('firstname').isString().trim().isLength({ min: 1, max: 80 }),
  body('lastname').isString().trim().isLength({ min: 1, max: 80 }),
  body('type').isIn(['registered']),
  body('nationality').isString().isLength({ min: 2, max: 2 }),
  body('status').isIn(['valid', 'expired', 'blocked']),
  body('id_verified').optional().isIn(['VERIFIED', 'UNVERIFIED', 'FAIL']),
  body('orgtype').isIn(['Individual', 'Corporate']),
  validate,
  (req: Request, _res: Response, next: NextFunction) => {
    req.body.remitter_id = req.params.remitter_id;
    next();
  },
  ctrl.update,
);

router.post(
  '/verify',
  body('remitter_id').isString().notEmpty(),
  body('agent_name').isString().notEmpty(),
  validate,
  ctrl.verify,
);

export default router;

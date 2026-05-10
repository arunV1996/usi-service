'use strict';

const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/beneficiaryController');

router.post('/account-types', ctrl.getAccountTypes);

router.post('/',
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

router.post('/search',
  body('linked_remitter_id').optional().isInt({ min: 1 }),
  body('beneficiary_id').optional().isInt({ min: 1 }),
  body('country').optional().isString().isLength({ max: 80 }),
  validate,
  ctrl.search,
);

router.put('/:beneficiary_id',
  body('country').optional().isString().isLength({ max: 80 }),
  body('email').optional().isEmail(),
  validate,
  (req, _res, next) => { req.body.beneficiary_id = req.params.beneficiary_id; next(); },
  ctrl.update,
);

module.exports = router;

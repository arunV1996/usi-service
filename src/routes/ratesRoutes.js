'use strict';

const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/ratesController');

router.post('/',
  body('dest_country').isString().trim().notEmpty().isLength({ max: 80 }),
  body('source_currency').optional().isString().isLength({ max: 8 }),
  body('dest_currency').optional().isString().isLength({ max: 8 }),
  body('delivery_bank').optional().isString().isLength({ max: 80 }),
  validate,
  ctrl.getRates,
);

module.exports = router;

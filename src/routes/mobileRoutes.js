'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/mobileController');

router.post('/operators', ctrl.operators);
router.post('/credit-types', ctrl.creditTypes);

module.exports = router;

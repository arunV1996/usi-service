'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/deliveryController');

router.post('/banks', ctrl.banks);
router.post('/branches', ctrl.branches);
router.post('/collection-points', ctrl.collectionPoints);

module.exports = router;

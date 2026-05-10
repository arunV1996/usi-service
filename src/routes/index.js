'use strict';

const router = require('express').Router();

router.use('/agent', require('./agentRoutes'));
router.use('/countries', require('./countryRoutes'));
router.use('/rates', require('./ratesRoutes'));
router.use('/remitters', require('./remitterRoutes'));
router.use('/beneficiaries', require('./beneficiaryRoutes'));
router.use('/transactions', require('./transactionRoutes'));
router.use('/delivery', require('./deliveryRoutes'));
router.use('/mobile', require('./mobileRoutes'));
router.use('/audit', require('./auditRoutes'));

module.exports = router;

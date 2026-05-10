'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/agentController');

router.post('/details', ctrl.getAgentDetails);
router.post('/credit', ctrl.getCurrentCredit);

module.exports = router;

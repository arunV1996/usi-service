'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/countryController');

router.post('/destinations', ctrl.getDestinationCountries);

module.exports = router;

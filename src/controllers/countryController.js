'use strict';

const countryService = require('../services/usi/countryService');
const { respond, ctx } = require('./_respond');

exports.getDestinationCountries = async (req, res, next) => {
  try { respond(req, res, await countryService.getDestinationCountries(ctx(req))); } catch (e) { next(e); }
};

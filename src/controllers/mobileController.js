'use strict';

const mobileService = require('../services/usi/mobileService');
const { respond, ctx } = require('./_respond');

exports.operators = async (req, res, next) => {
  try {
    respond(req, res, await mobileService.getMobileNetworkOperators(ctx(req), {
      country_id: req.body.country_id || req.query.country_id,
      country_code: req.body.country_code || req.query.country_code,
    }));
  } catch (e) { next(e); }
};

exports.creditTypes = async (req, res, next) => {
  try {
    respond(req, res, await mobileService.getMobileNetworkCreditTypes(ctx(req), {
      country_id: req.body.country_id,
      dest_country: req.body.dest_country,
      country_code: req.body.country_code,
      mobile_network_operator_name: req.body.mobile_network_operator_name,
      enabled: req.body.enabled,
    }));
  } catch (e) { next(e); }
};

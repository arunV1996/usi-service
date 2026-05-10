'use strict';

const ratesService = require('../services/usi/ratesService');
const { respond, ctx } = require('./_respond');

exports.getRates = async (req, res, next) => {
  try {
    const { source_currency, dest_country, dest_currency, delivery_bank } = req.body;
    respond(req, res, await ratesService.getRates(ctx(req), {
      source_currency, dest_country, dest_currency, 'Delivery Bank Name': delivery_bank,
    }));
  } catch (e) { next(e); }
};

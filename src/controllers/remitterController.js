'use strict';

const remitterService = require('../services/usi/remitterService');
const { respond, ctx } = require('./_respond');

const REMITTER_FIELDS = [
  'firstname', 'lastname', 'type', 'nationality', 'gender', 'status',
  'address1', 'address2', 'city', 'state', 'postcode', 'mobile',
  'dob', 'country_of_birth', 'id_type', 'id_details', 'id_start',
  'id_expiry', 'orgtype', 'company_name', 'company_reg_no',
];

const SEARCH_FIELDS = [
  'remitter_id', 'firstname', 'lastname', 'dob', 'address_line1', 'city',
  'postcode', 'mobile', 'id1_type', 'id1_details', 'remitter_type', 'show_scans',
];

const UPDATE_FIELDS = [
  'remitter_id', 'firstname', 'lastname', 'type', 'nationality', 'status',
  'address1', 'address2', 'city', 'state', 'postcode', 'mobile', 'dob',
  'country_of_birth', 'id_type', 'id_details', 'id_start', 'id_expiry',
  'id_verified', 'orgtype', 'company_name', 'company_reg_no',
];

function pick(body, fields) {
  const out = {};
  for (const f of fields) if (body[f] !== undefined) out[f] = body[f];
  return out;
}

exports.create = async (req, res, next) => {
  try { respond(req, res, await remitterService.createRemitter(ctx(req), pick(req.body, REMITTER_FIELDS))); }
  catch (e) { next(e); }
};

exports.search = async (req, res, next) => {
  try { respond(req, res, await remitterService.searchRemitter(ctx(req), pick(req.body, SEARCH_FIELDS))); }
  catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try { respond(req, res, await remitterService.updateRemitter(ctx(req), pick(req.body, UPDATE_FIELDS))); }
  catch (e) { next(e); }
};

exports.verify = async (req, res, next) => {
  try {
    respond(req, res, await remitterService.verifyRemitter(ctx(req), {
      remitter_id: req.body.remitter_id,
      agent_name: req.body.agent_name,
    }));
  } catch (e) { next(e); }
};

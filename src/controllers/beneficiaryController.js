'use strict';

const beneficiaryService = require('../services/usi/beneficiaryService');
const { respond, ctx } = require('./_respond');

const CREATE_FIELDS = [
  'name', 'fname', 'lname', 'organisation_type', 'company_name', 'company_reg_no',
  'address1', 'address2', 'city', 'state', 'postcode', 'country', 'mobile', 'email',
  'account_number', 'bank', 'bank_branch', 'bank_branch_city', 'bank_branch_state',
  'benef_bank_swift_code', 'benef_bank_ifsc_code', 'benef_bank_iban', 'linked_member_id',
];

const SEARCH_FIELDS = [
  'beneficiary_id', 'linked_remitter_id', 'name', 'fname', 'lname',
  'address_line1', 'city', 'country', 'mobile', 'account_number',
];

const UPDATE_FIELDS = [
  'beneficiary_id', 'name', 'fname', 'lname', 'organisation_type', 'company_name',
  'company_reg_no', 'address1', 'address2', 'city', 'state', 'postcode', 'country',
  'mobile', 'email', 'account_number', 'bank', 'bank_branch', 'bank_branch_city',
  'bank_branch_state', 'benef_bank_swift_code', 'benef_bank_ifsc_code',
];

function pick(body, fields) {
  const out = {};
  for (const f of fields) if (body[f] !== undefined) out[f] = body[f];
  return out;
}

exports.getAccountTypes = async (req, res, next) => {
  try { respond(req, res, await beneficiaryService.getBeneficiaryAccountTypes(ctx(req))); }
  catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try { respond(req, res, await beneficiaryService.createBeneficiary(ctx(req), pick(req.body, CREATE_FIELDS))); }
  catch (e) { next(e); }
};

exports.search = async (req, res, next) => {
  try { respond(req, res, await beneficiaryService.searchBeneficiary(ctx(req), pick(req.body, SEARCH_FIELDS))); }
  catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try { respond(req, res, await beneficiaryService.updateBeneficiary(ctx(req), pick(req.body, UPDATE_FIELDS))); }
  catch (e) { next(e); }
};

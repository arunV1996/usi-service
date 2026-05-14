import type { Request, Response, NextFunction } from 'express';
import * as beneficiaryService from '../services/usi/beneficiaryService';
import { respond, ctx } from './_respond';

const CREATE_FIELDS = [
  'name', 'fname', 'lname', 'organisation_type', 'company_name', 'company_reg_no',
  'address1', 'address2', 'city', 'state', 'postcode', 'country', 'mobile', 'email',
  'account_number', 'bank', 'bank_branch', 'bank_branch_city', 'bank_branch_state',
  'benef_bank_swift_code', 'benef_bank_ifsc_code', 'benef_bank_iban', 'linked_member_id',
] as const;

const SEARCH_FIELDS = [
  'beneficiary_id', 'linked_remitter_id', 'name', 'fname', 'lname',
  'address_line1', 'city', 'country', 'mobile', 'account_number',
] as const;

const UPDATE_FIELDS = [
  'beneficiary_id', 'name', 'fname', 'lname', 'organisation_type', 'company_name',
  'company_reg_no', 'address1', 'address2', 'city', 'state', 'postcode', 'country',
  'mobile', 'email', 'account_number', 'bank', 'bank_branch', 'bank_branch_city',
  'bank_branch_state', 'benef_bank_swift_code', 'benef_bank_ifsc_code',
] as const;

function pick(body: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (body[f] !== undefined) out[f] = body[f];
  return out;
}

export const getAccountTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    respond(req, res, await beneficiaryService.getBeneficiaryAccountTypes(ctx(req)));
  } catch (e) {
    next(e);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    respond(req, res, await beneficiaryService.createBeneficiary(ctx(req), pick(req.body, CREATE_FIELDS)));
  } catch (e) {
    next(e);
  }
};

export const search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    respond(req, res, await beneficiaryService.searchBeneficiary(ctx(req), pick(req.body, SEARCH_FIELDS)));
  } catch (e) {
    next(e);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    respond(req, res, await beneficiaryService.updateBeneficiary(ctx(req), pick(req.body, UPDATE_FIELDS)));
  } catch (e) {
    next(e);
  }
};

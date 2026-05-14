import type { Request, Response, NextFunction } from 'express';
import * as transactionService from '../services/usi/transactionService';
import { respond, ctx } from './_respond';

const CREATE_FIELDS = [
  'remitter_id', 'beneficiary_id', 'relation_to_remitter', 'destination_country',
  'agent_trans_ref', 'benef_trans_ref', 'trans_type', 'purpose', 'source_of_income',
  'collection_point_id', 'collection_point', 'collection_point_code',
  'collection_point_bank', 'collection_point_address', 'collection_point_city',
  'collection_point_state', 'benef_mobiletransfer_number',
  'benef_mobiletransfer_network_id', 'benef_mobiletransfer_network',
  'benef_mobiletransfer_network_credit_type_id', 'payment_method', 'service_level',
  'sms_confirmation', 'sms_notification', 'source_currency', 'dest_currency',
  'amount_type', 'amount_to_send',
] as const;

const CHARGES_FIELDS = [
  'destination_country', 'trans_type', 'payment_method', 'service_level',
  'sms_confirmation', 'sms_notification', 'amount_type', 'amount_to_send',
  'source_currency', 'dest_currency',
] as const;

function pick(body: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (body[f] !== undefined) out[f] = body[f];
  return out;
}

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    respond(req, res, await transactionService.createTransaction(ctx(req), pick(req.body, CREATE_FIELDS)));
  } catch (e) {
    next(e);
  }
};

export const confirm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    respond(
      req,
      res,
      await transactionService.confirmTransaction(ctx(req), {
        trans_session_id: req.body.trans_session_id,
      }),
    );
  } catch (e) {
    next(e);
  }
};

export const statusByTransRef = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    respond(
      req,
      res,
      await transactionService.getTransactionStatus(ctx(req), {
        trans_ref: req.params.trans_ref,
      }),
    );
  } catch (e) {
    next(e);
  }
};

export const statusByAgentRef = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    respond(
      req,
      res,
      await transactionService.getTransactionStatusByAgentTransRef(ctx(req), {
        trans_ref: req.params.agent_trans_ref,
      }),
    );
  } catch (e) {
    next(e);
  }
};

export const charges = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    respond(req, res, await transactionService.getCharges(ctx(req), pick(req.body, CHARGES_FIELDS)));
  } catch (e) {
    next(e);
  }
};

import type { Request, Response, NextFunction } from 'express';
import * as deliveryService from '../services/usi/deliveryService';
import { respond, ctx } from './_respond';

export const banks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    respond(
      req,
      res,
      await deliveryService.getDeliveryBanks(ctx(req), {
        dest_country: req.body.dest_country || req.query.dest_country,
        country_code: req.body.country_code || req.query.country_code,
        bank_code: req.body.bank_code || req.query.bank_code,
      }),
    );
  } catch (e) {
    next(e);
  }
};

export const branches = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    respond(
      req,
      res,
      await deliveryService.getDeliveryBankBranches(ctx(req), {
        delivery_bank: req.body.delivery_bank,
        destination_country: req.body.destination_country,
        destination_country_code: req.body.destination_country_code,
      }),
    );
  } catch (e) {
    next(e);
  }
};

export const collectionPoints = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    respond(
      req,
      res,
      await deliveryService.getCollectionPoints(ctx(req), {
        delivery_bank: req.body.delivery_bank,
        destination_country: req.body.destination_country,
        destination_country_code: req.body.destination_country_code,
      }),
    );
  } catch (e) {
    next(e);
  }
};

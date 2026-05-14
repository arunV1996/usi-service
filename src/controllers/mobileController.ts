import type { Request, Response, NextFunction } from 'express';
import * as mobileService from '../services/usi/mobileService';
import { respond, ctx } from './_respond';

export const operators = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    respond(
      req,
      res,
      await mobileService.getMobileNetworkOperators(ctx(req), {
        country_id: req.body.country_id || req.query.country_id,
        country_code: req.body.country_code || req.query.country_code,
      }),
    );
  } catch (e) {
    next(e);
  }
};

export const creditTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    respond(
      req,
      res,
      await mobileService.getMobileNetworkCreditTypes(ctx(req), {
        country_id: req.body.country_id,
        dest_country: req.body.dest_country,
        country_code: req.body.country_code,
        mobile_network_operator_name: req.body.mobile_network_operator_name,
        enabled: req.body.enabled,
      }),
    );
  } catch (e) {
    next(e);
  }
};

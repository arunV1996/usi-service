import type { Request, Response, NextFunction } from 'express';
import * as ratesService from '../services/usi/ratesService';
import { respond, ctx } from './_respond';

export const getRates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { source_currency, dest_country, dest_currency, delivery_bank } = req.body as Record<string, unknown>;
    respond(
      req,
      res,
      await ratesService.getRates(ctx(req), {
        source_currency,
        dest_country,
        dest_currency,
        'Delivery Bank Name': delivery_bank,
      }),
    );
  } catch (e) {
    next(e);
  }
};

import type { Request, Response, NextFunction } from 'express';
import * as countryService from '../services/usi/countryService';
import { respond, ctx } from './_respond';

export const getDestinationCountries = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    respond(req, res, await countryService.getDestinationCountries(ctx(req)));
  } catch (e) {
    next(e);
  }
};

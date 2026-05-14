import type { Request, Response, NextFunction } from 'express';
import * as agentService from '../services/usi/agentService';
import { respond, ctx } from './_respond';

export const getAgentDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    respond(req, res, await agentService.getAgentDetails(ctx(req)));
  } catch (e) {
    next(e);
  }
};

export const getCurrentCredit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    respond(req, res, await agentService.getCurrentCredit(ctx(req)));
  } catch (e) {
    next(e);
  }
};

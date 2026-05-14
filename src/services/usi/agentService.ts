import { call } from './httpClient';
import type { Ctx, USIResult } from '../../types';

export const getAgentDetails = (ctx: Ctx): Promise<USIResult> =>
  call({ correlationId: ctx.correlationId, group: 'agent', method: 'getAgentDetails' });

export const getCurrentCredit = (ctx: Ctx): Promise<USIResult> =>
  call({ correlationId: ctx.correlationId, group: 'agent', method: 'getCurrentCredit' });

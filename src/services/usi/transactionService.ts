import { call } from './httpClient';
import type { Ctx, USIResult } from '../../types';

const group = 'transaction';

export const createTransaction = (ctx: Ctx, params: Record<string, unknown>): Promise<USIResult> =>
  call({ correlationId: ctx.correlationId, group, method: 'createTransaction', params });

export const confirmTransaction = (ctx: Ctx, params: Record<string, unknown>): Promise<USIResult> =>
  call({ correlationId: ctx.correlationId, group, method: 'confirmTransaction', params });

export const getTransactionStatus = (ctx: Ctx, params: Record<string, unknown>): Promise<USIResult> =>
  call({ correlationId: ctx.correlationId, group, method: 'getTransactionStatus', params });

export const getTransactionStatusByAgentTransRef = (
  ctx: Ctx,
  params: Record<string, unknown>,
): Promise<USIResult> =>
  call({
    correlationId: ctx.correlationId,
    group,
    method: 'getTransactionStatusByAgentTransRef',
    params,
  });

export const getCharges = (ctx: Ctx, params: Record<string, unknown>): Promise<USIResult> =>
  call({ correlationId: ctx.correlationId, group, method: 'getCharges', params });

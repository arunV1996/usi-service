import { call } from './httpClient';
import type { Ctx, USIResult } from '../../types';

const group = 'remitter';

export const createRemitter = (ctx: Ctx, params: Record<string, unknown>): Promise<USIResult> =>
  call({ correlationId: ctx.correlationId, group, method: 'createRemitter', params });

export const searchRemitter = (ctx: Ctx, params: Record<string, unknown>): Promise<USIResult> =>
  call({ correlationId: ctx.correlationId, group, method: 'searchRemitter', params });

export const updateRemitter = (ctx: Ctx, params: Record<string, unknown>): Promise<USIResult> =>
  call({ correlationId: ctx.correlationId, group, method: 'updateRemitter', params });

export const verifyRemitter = (ctx: Ctx, params: Record<string, unknown>): Promise<USIResult> =>
  call({ correlationId: ctx.correlationId, group, method: 'verifyRemitter', params });

import { call } from './httpClient';
import type { Ctx, USIResult } from '../../types';

export const getRates = (ctx: Ctx, params: Record<string, unknown>): Promise<USIResult> =>
  call({ correlationId: ctx.correlationId, group: 'rates', method: 'getRates', params });

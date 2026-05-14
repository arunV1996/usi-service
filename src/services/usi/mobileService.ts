import { call } from './httpClient';
import type { Ctx, USIResult } from '../../types';

export const getMobileNetworkOperators = (
  ctx: Ctx,
  params: Record<string, unknown>,
): Promise<USIResult> =>
  call({
    correlationId: ctx.correlationId,
    group: 'mobileNetworkOperator',
    method: 'getMobileNetworkOperators',
    params,
  });

export const getMobileNetworkCreditTypes = (
  ctx: Ctx,
  params: Record<string, unknown>,
): Promise<USIResult> =>
  call({
    correlationId: ctx.correlationId,
    group: 'mobileNetworkCreditType',
    method: 'getMobileNetworkCreditTypes',
    params,
  });

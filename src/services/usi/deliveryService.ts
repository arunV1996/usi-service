import { call } from './httpClient';
import type { Ctx, USIResult } from '../../types';

export const getDeliveryBanks = (ctx: Ctx, params: Record<string, unknown>): Promise<USIResult> =>
  call({
    correlationId: ctx.correlationId,
    group: 'deliveryBank',
    method: 'getDeliveryBanks',
    params,
  });

export const getDeliveryBankBranches = (
  ctx: Ctx,
  params: Record<string, unknown>,
): Promise<USIResult> =>
  call({
    correlationId: ctx.correlationId,
    group: 'deliveryBankBranch',
    method: 'getDeliveryBankBranches',
    params,
  });

export const getCollectionPoints = (
  ctx: Ctx,
  params: Record<string, unknown>,
): Promise<USIResult> =>
  call({
    correlationId: ctx.correlationId,
    group: 'collectionPoint',
    method: 'getCollectionPoints',
    params,
  });

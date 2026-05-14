import { call } from './httpClient';
import type { Ctx, USIResult } from '../../types';

const group = 'beneficiary';

export const getBeneficiaryAccountTypes = (ctx: Ctx): Promise<USIResult> =>
  call({ correlationId: ctx.correlationId, group, method: 'getBeneficiaryAccountTypes' });

export const createBeneficiary = (ctx: Ctx, params: Record<string, unknown>): Promise<USIResult> =>
  call({ correlationId: ctx.correlationId, group, method: 'createBeneficiary', params });

export const searchBeneficiary = (ctx: Ctx, params: Record<string, unknown>): Promise<USIResult> =>
  call({ correlationId: ctx.correlationId, group, method: 'searchBeneficiary', params });

export const updateBeneficiary = (ctx: Ctx, params: Record<string, unknown>): Promise<USIResult> =>
  call({ correlationId: ctx.correlationId, group, method: 'updateBeneficiary', params });

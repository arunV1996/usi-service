import { call } from './httpClient';
import type { Ctx, USIResult } from '../../types';

export const getDestinationCountries = (ctx: Ctx): Promise<USIResult> =>
  call({ correlationId: ctx.correlationId, group: 'country', method: 'getDestinationCountries' });

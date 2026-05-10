'use strict';

const { call } = require('./httpClient');

const group = 'beneficiary';

module.exports = {
  getBeneficiaryAccountTypes: (ctx) =>
    call({ correlationId: ctx.correlationId, group, method: 'getBeneficiaryAccountTypes' }),
  createBeneficiary: (ctx, params) =>
    call({ correlationId: ctx.correlationId, group, method: 'createBeneficiary', params }),
  searchBeneficiary: (ctx, params) =>
    call({ correlationId: ctx.correlationId, group, method: 'searchBeneficiary', params }),
  updateBeneficiary: (ctx, params) =>
    call({ correlationId: ctx.correlationId, group, method: 'updateBeneficiary', params }),
};

'use strict';

const { call } = require('./httpClient');

const group = 'transaction';

module.exports = {
  createTransaction: (ctx, params) =>
    call({ correlationId: ctx.correlationId, group, method: 'createTransaction', params }),
  confirmTransaction: (ctx, params) =>
    call({ correlationId: ctx.correlationId, group, method: 'confirmTransaction', params }),
  getTransactionStatus: (ctx, params) =>
    call({ correlationId: ctx.correlationId, group, method: 'getTransactionStatus', params }),
  getTransactionStatusByAgentTransRef: (ctx, params) =>
    call({
      correlationId: ctx.correlationId,
      group,
      method: 'getTransactionStatusByAgentTransRef',
      params,
    }),
  getCharges: (ctx, params) =>
    call({ correlationId: ctx.correlationId, group, method: 'getCharges', params }),
};

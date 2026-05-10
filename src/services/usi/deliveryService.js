'use strict';

const { call } = require('./httpClient');

module.exports = {
  getDeliveryBanks: (ctx, params) =>
    call({
      correlationId: ctx.correlationId,
      group: 'deliveryBank',
      method: 'getDeliveryBanks',
      params,
    }),
  getDeliveryBankBranches: (ctx, params) =>
    call({
      correlationId: ctx.correlationId,
      group: 'deliveryBankBranch',
      method: 'getDeliveryBankBranches',
      params,
    }),
  getCollectionPoints: (ctx, params) =>
    call({
      correlationId: ctx.correlationId,
      group: 'collectionPoint',
      method: 'getCollectionPoints',
      params,
    }),
};

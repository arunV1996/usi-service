'use strict';

const { call } = require('./httpClient');

module.exports = {
  getMobileNetworkOperators: (ctx, params) =>
    call({
      correlationId: ctx.correlationId,
      group: 'mobileNetworkOperator',
      method: 'getMobileNetworkOperators',
      params,
    }),
  getMobileNetworkCreditTypes: (ctx, params) =>
    call({
      correlationId: ctx.correlationId,
      group: 'mobileNetworkCreditType',
      method: 'getMobileNetworkCreditTypes',
      params,
    }),
};

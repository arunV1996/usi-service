'use strict';

const { call } = require('./httpClient');

module.exports = {
  getRates: (ctx, params) =>
    call({ correlationId: ctx.correlationId, group: 'rates', method: 'getRates', params }),
};

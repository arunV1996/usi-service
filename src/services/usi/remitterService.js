'use strict';

const { call } = require('./httpClient');

const group = 'remitter';

module.exports = {
  createRemitter: (ctx, params) =>
    call({ correlationId: ctx.correlationId, group, method: 'createRemitter', params }),
  searchRemitter: (ctx, params) =>
    call({ correlationId: ctx.correlationId, group, method: 'searchRemitter', params }),
  updateRemitter: (ctx, params) =>
    call({ correlationId: ctx.correlationId, group, method: 'updateRemitter', params }),
  verifyRemitter: (ctx, params) =>
    call({ correlationId: ctx.correlationId, group, method: 'verifyRemitter', params }),
};

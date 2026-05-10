'use strict';

const { call } = require('./httpClient');

module.exports = {
  getAgentDetails: (ctx) =>
    call({ correlationId: ctx.correlationId, group: 'agent', method: 'getAgentDetails' }),
  getCurrentCredit: (ctx) =>
    call({ correlationId: ctx.correlationId, group: 'agent', method: 'getCurrentCredit' }),
};

'use strict';

const { call } = require('./httpClient');

module.exports = {
  getDestinationCountries: (ctx) =>
    call({ correlationId: ctx.correlationId, group: 'country', method: 'getDestinationCountries' }),
};

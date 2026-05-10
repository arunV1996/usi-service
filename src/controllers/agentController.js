'use strict';

const agentService = require('../services/usi/agentService');
const { respond, ctx } = require('./_respond');

exports.getAgentDetails = async (req, res, next) => {
  try { respond(req, res, await agentService.getAgentDetails(ctx(req))); } catch (e) { next(e); }
};

exports.getCurrentCredit = async (req, res, next) => {
  try { respond(req, res, await agentService.getCurrentCredit(ctx(req))); } catch (e) { next(e); }
};

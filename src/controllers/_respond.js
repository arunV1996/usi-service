'use strict';

/**
 * Translates a USI httpClient result into our standard internal response.
 * - Upstream SUCCESS  -> 200 with parsed result.
 * - Upstream FAIL     -> 502 with extracted message.
 * - Network/timeout   -> 504.
 */
function respond(req, res, result) {
  const correlationId = req.correlationId;
  const auditId = result.auditId;

  if (!result || result.error) {
    return res.status(504).json({
      status: 'FAIL',
      error: {
        code: 'UPSTREAM_UNREACHABLE',
        message: 'Failed to contact upstream payment provider',
        correlation_id: correlationId,
        audit_id: auditId,
      },
    });
  }

  const parsed = (result.parsed && result.parsed.response) || {};
  if (result.upstreamStatus === 'SUCCESS') {
    return res.status(200).json({
      status: 'SUCCESS',
      data: parsed.result || extractTopLevel(parsed),
      meta: {
        correlation_id: correlationId,
        audit_id: auditId,
        upstream_response_id: parsed.responseId || null,
        duration_ms: result.durationMs,
      },
    });
  }

  // FAIL or unparseable
  const upstreamErr = (parsed.result && parsed.result.message) || 'Upstream rejected the request';
  const validation = parsed.result && parsed.result.errors && parsed.result.errors.error;
  return res.status(502).json({
    status: 'FAIL',
    error: {
      code: 'UPSTREAM_FAILURE',
      message: upstreamErr,
      details: validation || undefined,
      correlation_id: correlationId,
      audit_id: auditId,
    },
  });
}

// Some upstream methods (createRemitter, createBeneficiary) put their payload
// at the top level (e.g. <new_remitter_id>) instead of inside <result>.
function extractTopLevel(parsedResponse) {
  const out = {};
  for (const [k, v] of Object.entries(parsedResponse)) {
    if (k === 'status' || k === 'responseId' || k === 'result') continue;
    out[k] = v;
  }
  return out;
}

function ctx(req) {
  return { correlationId: req.correlationId };
}

module.exports = { respond, ctx };

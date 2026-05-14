import type { Request, Response } from 'express';
import type { Ctx, USIResult } from '../types';

interface ParsedResponseShape {
  status?: string;
  responseId?: string;
  result?: {
    message?: string;
    errors?: { error?: string | string[] };
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

/**
 * Translates a USI httpClient result into our standard internal response.
 */
export function respond(req: Request, res: Response, result: USIResult): Response {
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

  const parsedRoot = (result.parsed as { response?: ParsedResponseShape } | null) || null;
  const parsed: ParsedResponseShape = (parsedRoot && parsedRoot.response) || {};

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

function extractTopLevel(parsedResponse: ParsedResponseShape): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsedResponse)) {
    if (k === 'status' || k === 'responseId' || k === 'result') continue;
    out[k] = v;
  }
  return out;
}

export function ctx(req: Request): Ctx {
  return { correlationId: req.correlationId };
}

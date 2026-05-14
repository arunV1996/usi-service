import type { Request, Response, NextFunction } from 'express';
import * as auditStore from '../helpers/auditStore';

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = req.query;
    const items = await auditStore.query({
      correlationId: typeof q.correlation_id === 'string' ? q.correlation_id : undefined,
      operation: typeof q.operation === 'string' ? q.operation : undefined,
      upstreamStatus: typeof q.upstream_status === 'string' ? q.upstream_status : undefined,
      fromDate: typeof q.from === 'string' ? q.from : undefined,
      toDate: typeof q.to === 'string' ? q.to : undefined,
      limit: typeof q.limit === 'string' ? q.limit : undefined,
      includeBodies: false,
    });
    res.json({ status: 'SUCCESS', data: { count: items.length, items } });
  } catch (e) {
    next(e);
  }
};

export const detail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const items = await auditStore.query({ id: req.params.id, includeBodies: true });
    if (!items.length) {
      res.status(404).json({
        status: 'FAIL',
        error: { code: 'NOT_FOUND', message: 'Audit entry not found' },
      });
      return;
    }
    res.json({ status: 'SUCCESS', data: items[0] });
  } catch (e) {
    next(e);
  }
};

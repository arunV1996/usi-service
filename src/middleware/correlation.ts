import type { Request, Response, NextFunction } from 'express';
import { randomId } from '../helpers/crypto';

const HEADER = 'x-correlation-id';

export default function correlation(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(HEADER);
  const id = incoming && /^[A-Za-z0-9._-]{8,128}$/.test(incoming) ? incoming : randomId(12);
  req.correlationId = id;
  res.setHeader(HEADER, id);
  next();
}

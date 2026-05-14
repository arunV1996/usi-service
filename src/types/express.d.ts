import type { AuthContext } from './index';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      auth?: AuthContext;
    }
  }
}

export {};

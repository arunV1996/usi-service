import type { AuthContext } from './index';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      auth?: AuthContext;
      /** Raw request body bytes — captured by the body parser for signature verification. */
      rawBody?: Buffer;
    }
  }
}

export {};

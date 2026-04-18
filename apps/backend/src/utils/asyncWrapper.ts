import { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

// Wraps async route handlers and forwards any rejected promise to the
// centralised Express error middleware via next(). Without this, unhandled
// rejections in async handlers would crash the Node.js process.
export function asyncWrapper(handler: AsyncHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}

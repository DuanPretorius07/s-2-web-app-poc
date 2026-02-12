import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          requestId: crypto.randomUUID(),
          errorCode: 'VALIDATION_ERROR',
          message: 'Registration validation failed',
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            path: err.path,
          })),
        });
      }
      next(error);
    }
  };
}

export function validateQuery(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          requestId: crypto.randomUUID(),
          errorCode: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          errors: error.errors,
        });
      }
      next(error);
    }
  };
}

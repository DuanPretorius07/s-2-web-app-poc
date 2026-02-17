import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'validation.ts:validateBody:error',message:'Validation error caught',data:{path:req.path,method:req.method,errorFields:error.errors.map(e=>e.path.join('.')),errorMessages:error.errors.map(e=>e.message)},timestamp:Date.now(),runId:'login-error-debug',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        
        // Determine if this is a login or registration request based on the path
        const isLogin = req.path.includes('/login');
        const errorMessage = isLogin 
          ? 'Invalid email or password format' 
          : 'Registration validation failed';
        
        return res.status(400).json({
          requestId: crypto.randomUUID(),
          errorCode: 'VALIDATION_ERROR',
          message: errorMessage,
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

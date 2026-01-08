import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('[ERROR HANDLER] Error:', err);
  console.error('[ERROR HANDLER] Stack:', err.stack);

  const requestId = crypto.randomUUID();
  
  // Ensure response hasn't been sent
  if (res.headersSent) {
    console.error('[ERROR HANDLER] Response already sent, cannot send error response');
    return next(err);
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      requestId,
      errorCode: 'VALIDATION_ERROR',
      message: err.message,
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      requestId,
      errorCode: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  res.status(500).json({
    requestId,
    errorCode: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' 
      ? 'An internal error occurred' 
      : err.message,
  });
}

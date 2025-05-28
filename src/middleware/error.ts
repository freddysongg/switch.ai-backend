import { NextFunction, Request, Response } from 'express';

export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
  console.error('Error:', error);

  if (error.name === 'DatabaseError') {
    res.status(500).json({ error: 'Database operation failed' });
    return;
  }

  if (error.name === 'ValidationError') {
    res.status(400).json({ error: error.message });
    return;
  }

  if (error.name === 'AuthenticationError') {
    res.status(401).json({ error: 'Authentication failed' });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}

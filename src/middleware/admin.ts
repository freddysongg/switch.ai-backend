import { NextFunction, Request, Response } from 'express';

export const adminAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (req.user && req.user.role === 'admin') {
    console.log(`AdminAuthMiddleware: Admin access GRANTED for user: ${req.user.id}`);
    next();
  } else if (req.user) {
    console.warn(
      `AdminAuthMiddleware: Admin access DENIED for user: ${req.user.id}, role: ${req.user.role}`
    );
    res.status(403).json({ error: 'Forbidden: Administrator access required for this resource.' });
  } else {
    console.warn('AdminAuthMiddleware: Access DENIED. No authenticated user found on request.');
    res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  }
};

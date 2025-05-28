import { NextFunction, Request, Response } from 'express';

import { verifyAuthToken } from '../utils/supabase';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    const user = await verifyAuthToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

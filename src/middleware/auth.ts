import { NextFunction, Request, Response } from 'express';

// For development, always return a test user
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // const token = req.headers.authorization?.split(' ')[1];
    // if (!token) {
    //   return res.status(401).json({ error: 'No authentication token provided' });
    // }

    // const user = await verifyAuthToken(token);
    // if (!user) {
    //   return res.status(401).json({ error: 'Invalid authentication token' });
    // }

    // req.user = user;

    // Add test user to request
    req.user = {
      id: '8d813d95-a003-4d6a-8066-ea2d510f4a82',
      email: 'switchai@example.com',
      role: 'authenticated'
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

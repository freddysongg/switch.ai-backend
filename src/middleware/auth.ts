import { NextFunction, Request, Response } from 'express';

// Extend Request type to include user
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// For development, always return a test user
export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
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
      id: 'test-user',
      email: 'test@example.com',
      role: 'authenticated'
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

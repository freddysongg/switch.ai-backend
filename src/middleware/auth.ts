import { NextFunction, Request, Response } from 'express';

import { AuthService } from '../services/auth';

const authServiceInstance = new AuthService();

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  console.log('AuthMiddleware: Attempting JWT authentication...');
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('AuthMiddleware: No token or malformed Bearer header.');
      res.status(401).json({ error: 'Unauthorized: Authentication token is required.' });
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.warn('AuthMiddleware: Token string is empty after splitting Bearer header.');
      res.status(401).json({ error: 'Unauthorized: Token not found in Authorization header.' });
      return;
    }

    console.log('AuthMiddleware: Token found, attempting verification.');
    const decodedPayload = authServiceInstance.verifyToken(token);

    if (!decodedPayload || !decodedPayload.id || !decodedPayload.email || !decodedPayload.role) {
      console.warn('AuthMiddleware: JWT payload missing required fields');
      res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
      return;
    }

    req.user = {
      id: decodedPayload.id,
      email: decodedPayload.email,
      role: decodedPayload.role,
      name: decodedPayload.name
    };

    console.log(`AuthMiddleware: User authenticated: ${req.user.id}, Role: ${req.user.role}`);
    next();
  } catch (error) {
    console.error('AuthMiddleware: Critical error during authentication:', error);
    res.status(500).json({ error: 'Internal server error during authentication.' });
    return;
  }
};

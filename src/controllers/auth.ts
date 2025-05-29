import { Request, Response } from 'express';

import { AuthError, DatabaseError, ValidationError } from '@/db/errors';

import { AuthService } from '@/services/auth';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  async register(req: Request, res: Response): Promise<void> {
    console.log(`POST /api/auth/register - Request body:`, {
      email: req.body.email,
      name: req.body.name
    });
    try {
      const { email, password, name } = req.body;
      const user = await this.authService.registerUser({ email, password, name });
      console.log(`POST /api/auth/register - User registered successfully:`, user.id);
      res
        .status(201)
        .json({ message: 'User registered successfully', userId: user.id, email: user.email });
    } catch (error: any) {
      console.error(`POST /api/auth/register - Error:`, error.message);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof DatabaseError) {
        res.status(500).json({ error: 'Registration failed due to a database issue.' });
      } else {
        res.status(500).json({ error: 'An unexpected error occurred during registration.' });
      }
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    console.log(`POST /api/auth/login - Request for email:`, req.body.email);
    try {
      const { email, password } = req.body;
      const { token, user } = await this.authService.loginUser(email, password);
      console.log(`POST /api/auth/login - User logged in:`, user.id);
      res.status(200).json({
        message: 'Login successful',
        token,
        user: { id: user.id, email: user.email, name: user.name }
      });
    } catch (error: any) {
      console.error(`POST /api/auth/login - Error:`, error.message);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof AuthError) {
        res.status(401).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'An unexpected error occurred during login.' });
      }
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    console.log(`POST /api/auth/logout - Request received`);
    res
      .status(200)
      .json({ message: 'Logout successful. Please clear your token on the client-side.' });
  }

  async getMe(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    console.log(`GET /api/auth/me - User:`, req.user.id);
    const { id, email, name, role } = req.user as any;
    res.status(200).json({ id, email, name, role });
  }
}

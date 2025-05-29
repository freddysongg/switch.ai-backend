import type { User } from './user';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name?: string | null;
        email: string;
        createdAt?: Date;
        updatedAt?: Date;
        role?: string;
      };
    }
  }
}

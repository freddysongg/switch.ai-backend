import { Request, Response } from 'express';
import { validate as isValidUUID } from 'uuid';

import { DatabaseError, ValidationError } from '../db/errors.js';
import { UserService } from '../services/user.js';
import { UserUpdatePayload } from '../types/user.js';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async getAllUsers(req: Request, res: Response): Promise<void> {
    console.log(`GET /api/users - Request by UserID: ${req.user?.id}`);
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden: Administrator access required.' });
      return;
    }
    try {
      const users = await this.userService.getAllUsers();
      console.log(`GET /api/users - Response count:`, users.length);
      const safeUsers = users.map((u) => {
        const { hashedPassword, ...rest } = u;
        return rest;
      });
      res.status(200).json(safeUsers);
    } catch (error: any) {
      console.error(`GET /api/users - Error:`, error.message);
      if (error instanceof DatabaseError) {
        res.status(500).json({ error: 'Failed to retrieve users due to a database issue.' });
      } else {
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }

  async getUserById(req: Request, res: Response): Promise<void> {
    const { id: targetUserId } = req.params;
    const requestingUserId = req.user?.id;
    const requestingUserRole = req.user?.role;
    console.log(`GET /api/users/${targetUserId} - Request by UserID: ${requestingUserId}`);

    if (requestingUserId !== targetUserId && requestingUserRole !== 'admin') {
      res.status(403).json({ error: 'Forbidden: You do not have permission to access this user.' });
      return;
    }
    try {
      if (!isValidUUID(targetUserId)) {
        res.status(400).json({ error: 'Invalid target user ID format.' });
        return;
      }
      const user = await this.userService.getUserById(targetUserId);
      if (user) {
        const { hashedPassword, ...safeUser } = user;
        console.log(`GET /api/users/${targetUserId} - Response:`, safeUser);
        res.status(200).json(safeUser);
      } else {
        console.log(`GET /api/users/${targetUserId} - User not found.`);
        res.status(404).json({ error: 'User not found.' });
      }
    } catch (error: any) {
      console.error(`GET /api/users/${targetUserId} - Error:`, error.message);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof DatabaseError) {
        res.status(500).json({ error: 'Failed to retrieve user due to a database issue.' });
      } else {
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }

  async updateUser(req: Request, res: Response): Promise<void> {
    const { id: targetUserId } = req.params;
    const updateData = req.body as UserUpdatePayload;
    const requestingUserId = req.user?.id;
    const requestingUserRole = req.user?.role;
    console.log(
      `PUT /api/users/${targetUserId} - Request by UserID: ${requestingUserId}, Body:`,
      updateData
    );

    if (requestingUserId !== targetUserId && requestingUserRole !== 'admin') {
      res.status(403).json({ error: 'Forbidden: You do not have permission to update this user.' });
      return;
    }
    try {
      if (!isValidUUID(targetUserId)) {
        res.status(400).json({ error: 'Invalid target user ID format.' });
        return;
      }
      if (Object.keys(updateData).length === 0) {
        res.status(400).json({ error: 'No update data provided.' });
        return;
      }
      if ((updateData as any).password || (updateData as any).hashedPassword) {
        res.status(400).json({ error: 'Password updates are not allowed via this endpoint.' });
        return;
      }

      const updatedUser = await this.userService.updateUser(targetUserId, updateData);
      if (updatedUser) {
        const { hashedPassword, ...safeUser } = updatedUser;
        console.log(`PUT /api/users/${targetUserId} - Response:`, safeUser);
        res.status(200).json(safeUser);
      } else {
        const userExists = await this.userService.getUserById(targetUserId);
        if (!userExists) {
          console.log(`PUT /api/users/${targetUserId} - User not found.`);
          res.status(404).json({ error: 'User not found.' });
        } else {
          console.log(
            `PUT /api/users/${targetUserId} - User found but no changes made or update failed.`
          );
          res.status(200).json({
            message:
              'User found, but no changes were applied or update did not return modified data.'
          });
        }
      }
    } catch (error: any) {
      console.error(`PUT /api/users/${targetUserId} - Error:`, error.message);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof DatabaseError) {
        res.status(500).json({ error: 'Failed to update user due to a database issue.' });
      } else {
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }

  async deleteUser(req: Request, res: Response): Promise<void> {
    const { id: targetUserId } = req.params;
    const requestingUserId = req.user?.id;
    const requestingUserRole = req.user?.role;
    console.log(`DELETE /api/users/${targetUserId} - Request by UserID: ${requestingUserId}`);

    if (requestingUserRole !== 'admin' && requestingUserId !== targetUserId) {
      res.status(403).json({ error: 'Forbidden: You do not have permission to delete this user.' });
      return;
    }
    try {
      if (!isValidUUID(targetUserId)) {
        res.status(400).json({ error: 'Invalid target user ID format.' });
        return;
      }
      const deletedUser = await this.userService.deleteUser(targetUserId);
      if (deletedUser) {
        console.log(`DELETE /api/users/${targetUserId} - User deleted successfully.`);
        res.status(204).send();
      } else {
        console.log(`DELETE /api/users/${targetUserId} - User not found.`);
        res.status(404).json({ error: 'User not found.' });
      }
    } catch (error: any) {
      console.error(`DELETE /api/users/${targetUserId} - Error:`, error.message);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof DatabaseError) {
        if (error.message.includes('foreign key constraint')) {
          res.status(409).json({ error: `Cannot delete user: ${error.message}` });
        } else {
          res.status(500).json({ error: 'Failed to delete user due to a database issue.' });
        }
      } else {
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }
}

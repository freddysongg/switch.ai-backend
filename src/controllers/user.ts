import { Request, Response } from 'express';
import { validate as isValidUUID } from 'uuid';

import { DatabaseError, ValidationError } from '../db/errors';
import { UserService } from '../services/user';
import { UserCreatePayload, UserUpdatePayload } from '../types/user';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async createUser(req: Request, res: Response): Promise<void> {
    console.log(`POST /api/users - Request body:`, req.body);
    try {
      const { email, name } = req.body as UserCreatePayload;
      if (!email) {
        res.status(400).json({ error: 'Email is required.' });
        return;
      }

      const newUser = await this.userService.createUser({ email, name });
      console.log(`POST /api/users - Response:`, newUser);
      res.status(201).json(newUser);
    } catch (error: any) {
      console.error(`POST /api/users - Error:`, error.message);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof DatabaseError) {
        res.status(500).json({ error: 'Failed to create user due to a database issue.' });
      } else {
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }

  async getAllUsers(req: Request, res: Response): Promise<void> {
    console.log(`GET /api/users - Request`);
    // Security: In a real app, this endpoint should likely be admin-only.
    // Add authorization check here based on req.user.role if applicable.
    // if (req.user?.role !== 'admin') {
    //   res.status(403).json({ error: 'Forbidden: You do not have permission to access this resource.' });
    //   return;
    // }
    try {
      const users = await this.userService.getAllUsers();
      console.log(`GET /api/users - Response count:`, users.length);
      res.status(200).json(users);
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
    const { id } = req.params;
    console.log(`GET /api/users/${id} - Request`);
    // Security: A user should typically only be able to get their own details, or an admin can get any.
    // if (req.user?.id !== id && req.user?.role !== 'admin') {
    //    res.status(403).json({ error: 'Forbidden: You do not have permission to access this user.' });
    //    return;
    // }
    try {
      if (!isValidUUID(id)) {
        res.status(400).json({ error: 'Invalid user ID format.' });
        return;
      }
      const user = await this.userService.getUserById(id);
      if (user) {
        console.log(`GET /api/users/${id} - Response:`, user);
        res.status(200).json(user);
      } else {
        console.log(`GET /api/users/${id} - User not found.`);
        res.status(404).json({ error: 'User not found.' });
      }
    } catch (error: any) {
      console.error(`GET /api/users/${id} - Error:`, error.message);
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
    const { id } = req.params;
    const updateData = req.body as UserUpdatePayload;
    console.log(`PUT /api/users/${id} - Request body:`, updateData);

    // Security: A user should typically only be able to update their own details, or an admin can update any.
    // if (req.user?.id !== id && req.user?.role !== 'admin') {
    //    res.status(403).json({ error: 'Forbidden: You do not have permission to update this user.' });
    //    return;
    // }
    try {
      if (!isValidUUID(id)) {
        res.status(400).json({ error: 'Invalid user ID format.' });
        return;
      }
      if (Object.keys(updateData).length === 0) {
        res.status(400).json({ error: 'No update data provided.' });
        return;
      }

      const updatedUser = await this.userService.updateUser(id, updateData);
      if (updatedUser) {
        console.log(`PUT /api/users/${id} - Response:`, updatedUser);
        res.status(200).json(updatedUser);
      } else {
        const userExists = await this.userService.getUserById(id);
        if (!userExists) {
          console.log(`PUT /api/users/${id} - User not found.`);
          res.status(404).json({ error: 'User not found.' });
        } else {
          console.log(
            `PUT /api/users/${id} - User found but no changes made or update failed silently.`
          );
          res.status(200).json({
            message: 'User found, but no changes were applied or update did not return data.'
          });
        }
      }
    } catch (error: any) {
      console.error(`PUT /api/users/${id} - Error:`, error.message);
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
    const { id } = req.params;
    console.log(`DELETE /api/users/${id} - Request`);

    // Security: Typically only admins or the user themselves (with extra confirmation) can delete.
    // For this example, assuming admin or self-deletion might be allowed.
    // if (req.user?.id !== id && req.user?.role !== 'admin') {
    //    res.status(403).json({ error: 'Forbidden: You do not have permission to delete this user.' });
    //    return;
    // }
    try {
      if (!isValidUUID(id)) {
        res.status(400).json({ error: 'Invalid user ID format.' });
        return;
      }
      const deletedUser = await this.userService.deleteUser(id);
      if (deletedUser) {
        console.log(`DELETE /api/users/${id} - User deleted successfully.`);
        res.status(204).send();
      } else {
        console.log(`DELETE /api/users/${id} - User not found.`);
        res.status(404).json({ error: 'User not found.' });
      }
    } catch (error: any) {
      console.error(`DELETE /api/users/${id} - Error:`, error.message);
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

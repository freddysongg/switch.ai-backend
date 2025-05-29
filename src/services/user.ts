import { eq } from 'drizzle-orm';
import { validate as isValidUUID } from 'uuid';

import { db } from '../db';
import { DatabaseError, ValidationError } from '../db/errors';
import { users } from '../db/schema';
import { NewUserWithHashedPassword, User, UserUpdatePayload } from '../types/user';

export class UserService {
  async createUser(userData: NewUserWithHashedPassword): Promise<User> {
    if (!userData.email || !userData.hashedPassword) {
      throw new ValidationError(
        'Email and hashed password are required to create a user directly.'
      );
    }
    try {
      const [newUser] = await db.insert(users).values(userData).returning();
      if (!newUser) {
        throw new DatabaseError('Failed to create user, no record returned.');
      }
      return newUser;
    } catch (error: any) {
      console.error('Error creating user in UserService:', error);
      if (error.code === '23505') {
        throw new ValidationError(`User with email ${userData.email} already exists.`);
      }
      throw new DatabaseError('Failed to create user.', error);
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      const allUsers = await db.select().from(users);
      return allUsers;
    } catch (error: any) {
      console.error('Error fetching all users:', error);
      throw new DatabaseError('Failed to fetch users.', error);
    }
  }

  async getUserById(id: string): Promise<User | null> {
    if (!isValidUUID(id)) {
      throw new ValidationError('Invalid user ID format.');
    }
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return user || null;
    } catch (error: any) {
      console.error(`Error fetching user by ID ${id}:`, error);
      throw new DatabaseError(`Failed to fetch user by ID ${id}.`, error);
    }
  }

  async updateUser(id: string, updateData: UserUpdatePayload): Promise<User | null> {
    if (!isValidUUID(id)) {
      throw new ValidationError('Invalid user ID format.');
    }
    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No update data provided.');
    }
    if ((updateData as any).password || (updateData as any).hashedPassword) {
      throw new ValidationError(
        'Password updates must go through a dedicated change password endpoint.'
      );
    }

    try {
      const updatedUsers = await db
        .update(users)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();

      if (updatedUsers.length === 0) {
        return null;
      }
      return updatedUsers[0];
    } catch (error: any) {
      console.error(`Error updating user ID ${id}:`, error);
      if (updateData.email && error.code === '23505') {
        throw new ValidationError(`Another user with email ${updateData.email} already exists.`);
      }
      throw new DatabaseError(`Failed to update user ID ${id}.`, error);
    }
  }

  async deleteUser(id: string): Promise<{ id: string } | null> {
    if (!isValidUUID(id)) {
      throw new ValidationError('Invalid user ID format.');
    }
    try {
      const deletedUsers = await db
        .delete(users)
        .where(eq(users.id, id))
        .returning({ id: users.id });
      if (deletedUsers.length === 0) {
        return null;
      }
      return deletedUsers[0];
    } catch (error: any) {
      console.error(`Error deleting user ID ${id}:`, error);
      if (error.code === '23503') {
        throw new DatabaseError(
          `Cannot delete user ID ${id} as it is referenced by other records.`,
          error
        );
      }
      throw new DatabaseError(`Failed to delete user ID ${id}.`, error);
    }
  }
}

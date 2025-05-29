import { and, eq } from 'drizzle-orm';
import { validate as isValidUUID } from 'uuid';

import { AuthError, DatabaseError, ValidationError } from '../db/errors.js';
import { db } from '../db/index.js';
import { conversations } from '../db/schema.js';
import { Conversation, ConversationUpdatePayload, NewConversation } from '../types/conversation.js';

export class ConversationService {
  async createConversation(payload: NewConversation, userId: string): Promise<Conversation> {
    if (!isValidUUID(userId)) {
      throw new ValidationError('Invalid user ID format for creating conversation.');
    }
    try {
      const [newConversation] = await db
        .insert(conversations)
        .values({ ...payload, userId })
        .returning();
      if (!newConversation) {
        throw new DatabaseError('Failed to create conversation, no record returned.');
      }
      return newConversation;
    } catch (error: any) {
      console.error('Error creating conversation:', error);
      if (error.code === '23503') {
        throw new ValidationError(`User with ID ${userId} does not exist.`);
      }
      throw new DatabaseError('Failed to create conversation.', error);
    }
  }

  async getAllConversationsForUser(userId: string): Promise<Conversation[]> {
    if (!isValidUUID(userId)) {
      throw new ValidationError('Invalid user ID format for fetching conversations.');
    }
    try {
      const userConversations = await db
        .select()
        .from(conversations)
        .where(eq(conversations.userId, userId))
        .orderBy(conversations.updatedAt);
      return userConversations;
    } catch (error: any) {
      console.error(`Error fetching conversations for user ID ${userId}:`, error);
      throw new DatabaseError(`Failed to fetch conversations for user ID ${userId}.`, error);
    }
  }

  async getConversationById(id: string, userId: string): Promise<Conversation | null> {
    if (!isValidUUID(id) || !isValidUUID(userId)) {
      throw new ValidationError('Invalid ID format for conversation or user.');
    }
    try {
      const [conversation] = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
        .limit(1);

      return conversation || null;
    } catch (error: any) {
      console.error(`Error fetching conversation ID ${id} for user ID ${userId}:`, error);
      throw new DatabaseError(`Failed to fetch conversation ID ${id}.`, error);
    }
  }

  async updateConversation(
    id: string,
    updateData: ConversationUpdatePayload,
    userId: string
  ): Promise<Conversation | null> {
    if (!isValidUUID(id) || !isValidUUID(userId)) {
      throw new ValidationError('Invalid ID format for conversation or user.');
    }
    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No update data provided for conversation.');
    }

    try {
      const updatedConversations = await db
        .update(conversations)
        .set({ ...updateData, updatedAt: new Date() })
        .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
        .returning();

      if (updatedConversations.length === 0) {
        const exists = await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.id, id))
          .limit(1);
        if (exists.length === 0) return null;
        throw new AuthError(
          'User not authorized to update this conversation or conversation does not exist for this user.'
        );
      }
      return updatedConversations[0];
    } catch (error: any) {
      if (error instanceof AuthError) throw error;
      console.error(`Error updating conversation ID ${id} for user ID ${userId}:`, error);
      throw new DatabaseError(`Failed to update conversation ID ${id}.`, error);
    }
  }

  async deleteConversation(id: string, userId: string): Promise<{ id: string } | null> {
    if (!isValidUUID(id) || !isValidUUID(userId)) {
      throw new ValidationError('Invalid ID format for conversation or user.');
    }
    try {
      const deletedConversations = await db
        .delete(conversations)
        .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
        .returning({ id: conversations.id });

      if (deletedConversations.length === 0) {
        const exists = await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.id, id))
          .limit(1);
        if (exists.length === 0) return null;
        throw new AuthError(
          'User not authorized to delete this conversation or conversation does not exist for this user.'
        );
      }
      return deletedConversations[0];
    } catch (error: any) {
      if (error instanceof AuthError) throw error;
      console.error(`Error deleting conversation ID ${id} for user ID ${userId}:`, error);
      if (error.code === '23503') {
        throw new DatabaseError(
          `Cannot delete conversation ID ${id} as it is referenced by messages. Please delete associated messages first.`,
          error
        );
      }
      throw new DatabaseError(`Failed to delete conversation ID ${id}.`, error);
    }
  }
}

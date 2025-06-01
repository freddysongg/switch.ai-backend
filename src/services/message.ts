import { and, desc, eq } from 'drizzle-orm';
import { validate as isValidUUID } from 'uuid';

import { AuthError, DatabaseError, ValidationError } from '../db/errors.js';
import { db } from '../db/index.js';
import { conversations, messages } from '../db/schema.js';
import { Message, MessageUpdatePayload, NewMessage } from '../types/message.js';

export class MessageService {
  private async userOwnsConversation(userId: string, conversationId: string): Promise<boolean> {
    if (!isValidUUID(userId) || !isValidUUID(conversationId)) {
      throw new ValidationError('Invalid User ID or Conversation ID format.');
    }
    const [convo] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .limit(1);
    return !!convo;
  }

  async createMessage(
    payload: Omit<NewMessage, 'id' | 'timestamp' | 'createdAt'>,
    userId: string,
    conversationId: string
  ): Promise<Message> {
    if (!isValidUUID(userId) || !isValidUUID(conversationId)) {
      throw new ValidationError('Invalid User ID or Conversation ID format for creating message.');
    }
    if (!payload.content || payload.content.trim() === '') {
      throw new ValidationError('Message content cannot be empty.');
    }
    if (!payload.role) {
      throw new ValidationError('Message role is required.');
    }

    const ownsConversation = await this.userOwnsConversation(userId, conversationId);
    if (!ownsConversation) {
      throw new AuthError('User does not have access to this conversation to add a message.');
    }

    try {
      const [newMessage] = await db
        .insert(messages)
        .values({
          ...payload,
          userId,
          conversationId
        })
        .returning();
      if (!newMessage) {
        throw new DatabaseError('Failed to create message, no record returned.');
      }
      return newMessage;
    } catch (error: any) {
      console.error('Error creating message:', error);
      if (error.code === '23503') {
        throw new ValidationError(
          `Conversation with ID ${conversationId} or User with ID ${userId} does not exist.`
        );
      }
      throw new DatabaseError('Failed to create message.', error);
    }
  }

  async getMessagesInConversation(
    conversationId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Message[]> {
    if (!isValidUUID(userId) || !isValidUUID(conversationId)) {
      throw new ValidationError('Invalid User ID or Conversation ID format.');
    }
    const ownsConversation = await this.userOwnsConversation(userId, conversationId);
    if (!ownsConversation) {
      throw new AuthError('User does not have access to this conversation.');
    }

    try {
      const conversationMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.timestamp))
        .limit(limit)
        .offset(offset);
      return conversationMessages;
    } catch (error: any) {
      console.error(`Error fetching messages for conversation ID ${conversationId}:`, error);
      throw new DatabaseError(
        `Failed to fetch messages for conversation ID ${conversationId}.`,
        error
      );
    }
  }

  async getMessageById(messageId: string, userId: string): Promise<Message | null> {
    if (!isValidUUID(messageId) || !isValidUUID(userId)) {
      throw new ValidationError('Invalid Message ID or User ID format.');
    }
    try {
      const [message] = await db
        .select({
          id: messages.id,
          conversationId: messages.conversationId,
          userId: messages.userId,
          content: messages.content,
          role: messages.role,
          category: messages.category,
          metadata: messages.metadata,
          timestamp: messages.timestamp,
          createdAt: messages.createdAt
        })
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .where(and(eq(messages.id, messageId), eq(conversations.userId, userId)))
        .limit(1);

      return message || null;
    } catch (error: any) {
      console.error(`Error fetching message ID ${messageId} for user ID ${userId}:`, error);
      throw new DatabaseError(`Failed to fetch message ID ${messageId}.`, error);
    }
  }

  async updateMessage(
    messageId: string,
    updateData: MessageUpdatePayload,
    userId: string
  ): Promise<Message | null> {
    if (!isValidUUID(messageId) || !isValidUUID(userId)) {
      throw new ValidationError('Invalid Message ID or User ID format.');
    }
    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No update data provided for message.');
    }

    try {
      const [originalMessage] = await db
        .select({
          conversationId: messages.conversationId,
          role: messages.role,
          userId: messages.userId
        })
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      if (!originalMessage) return null;

      const ownsConversation = await this.userOwnsConversation(
        userId,
        originalMessage.conversationId
      );
      if (!ownsConversation) {
        throw new AuthError('User not authorized to update messages in this conversation.');
      }

      if (originalMessage.role === 'user' && originalMessage.userId !== userId) {
        throw new AuthError('Users can only update their own messages.');
      }

      const updatedMessages = await db
        .update(messages)
        .set({ ...updateData })
        .where(eq(messages.id, messageId))
        .returning();

      return updatedMessages.length > 0 ? updatedMessages[0] : null;
    } catch (error: any) {
      if (error instanceof AuthError) throw error;
      console.error(`Error updating message ID ${messageId}:`, error);
      throw new DatabaseError(`Failed to update message ID ${messageId}.`, error);
    }
  }

  async deleteMessage(messageId: string, userId: string): Promise<{ id: string } | null> {
    if (!isValidUUID(messageId) || !isValidUUID(userId)) {
      throw new ValidationError('Invalid Message ID or User ID format.');
    }
    try {
      const [originalMessage] = await db
        .select({
          conversationId: messages.conversationId,
          role: messages.role,
          userId: messages.userId
        })
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      if (!originalMessage) return null;

      const ownsConversation = await this.userOwnsConversation(
        userId,
        originalMessage.conversationId
      );
      if (!ownsConversation) {
        throw new AuthError('User not authorized to delete messages in this conversation.');
      }

      if (originalMessage.role === 'user' && originalMessage.userId !== userId) {
        throw new AuthError('Users can only delete their own messages.');
      }

      const deletedMessages = await db
        .delete(messages)
        .where(eq(messages.id, messageId))
        .returning({ id: messages.id });

      return deletedMessages.length > 0 ? deletedMessages[0] : null;
    } catch (error: any) {
      if (error instanceof AuthError) throw error;
      console.error(`Error deleting message ID ${messageId}:`, error);
      throw new DatabaseError(`Failed to delete message ID ${messageId}.`, error);
    }
  }
}

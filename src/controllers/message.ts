// src/controllers/message.controller.ts
import { Request, Response } from 'express';
import { validate as isValidUUID } from 'uuid';

import { AuthError, DatabaseError, ValidationError } from '../db/errors';
import { MessageService } from '../services/message';
import { MessageCreatePayload, MessageUpdatePayload } from '../types/message';

export class MessageController {
  private messageService: MessageService;

  constructor() {
    this.messageService = new MessageService();
  }

  async createMessage(req: Request, res: Response): Promise<void> {
    const { conversationId, ...payload } = req.body as MessageCreatePayload & {
      conversationId: string;
    };
    const userId = req.user?.id;
    console.log(
      `POST /api/messages - UserID: ${userId}, ConversationID: ${conversationId}, Payload:`,
      payload
    );

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized: User ID missing.' });
      return;
    }
    if (!conversationId || !isValidUUID(conversationId)) {
      res.status(400).json({ error: 'Valid Conversation ID is required in the request body.' });
      return;
    }
    if (!payload.content || !payload.role) {
      res.status(400).json({ error: 'Content and role are required.' });
      return;
    }

    try {
      const newMessage = await this.messageService.createMessage(
        payload as Omit<any, 'id' | 'timestamp' | 'createdAt'>,
        userId,
        conversationId
      );
      console.log(`POST /api/messages - Response:`, newMessage);
      res.status(201).json(newMessage);
    } catch (error: any) {
      console.error(`POST /api/messages - Error:`, error.message);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof AuthError) {
        res.status(403).json({ error: error.message });
      } else if (error instanceof DatabaseError) {
        res.status(500).json({ error: 'Failed to create message.' });
      } else {
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }

  async getMessagesInConversation(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const conversationId = req.query.conversationId as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    console.log(
      `GET /api/messages - UserID: ${userId}, ConversationID: ${conversationId}, Limit: ${limit}, Offset: ${offset}`
    );

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized: User ID missing.' });
      return;
    }
    if (!conversationId || !isValidUUID(conversationId)) {
      res.status(400).json({ error: 'Valid conversationId query parameter is required.' });
      return;
    }

    try {
      const messages = await this.messageService.getMessagesInConversation(
        conversationId,
        userId,
        limit,
        offset
      );
      console.log(
        `GET /api/messages - Response count for convo ${conversationId}:`,
        messages.length
      );
      res.status(200).json(messages);
    } catch (error: any) {
      console.error(`GET /api/messages?conversationId=${conversationId} - Error:`, error.message);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof AuthError) {
        res.status(403).json({ error: error.message });
      } else if (error instanceof DatabaseError) {
        res.status(500).json({ error: 'Failed to retrieve messages.' });
      } else {
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }

  async getMessageById(req: Request, res: Response): Promise<void> {
    const { id: messageId } = req.params;
    const userId = req.user?.id;
    console.log(`GET /api/messages/${messageId} - UserID: ${userId}`);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized: User ID missing.' });
      return;
    }
    if (!isValidUUID(messageId)) {
      res.status(400).json({ error: 'Invalid message ID format.' });
      return;
    }

    try {
      const message = await this.messageService.getMessageById(messageId, userId);
      if (message) {
        console.log(`GET /api/messages/${messageId} - Response:`, message);
        res.status(200).json(message);
      } else {
        console.log(`GET /api/messages/${messageId} - Message not found or user lacks access.`);
        res
          .status(404)
          .json({ error: 'Message not found or you do not have permission to access it.' });
      }
    } catch (error: any) {
      console.error(`GET /api/messages/${messageId} - Error:`, error.message);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof AuthError) {
        // Should not happen if service logic is correct for get by id
        res.status(403).json({ error: error.message });
      } else if (error instanceof DatabaseError) {
        res.status(500).json({ error: 'Failed to retrieve message.' });
      } else {
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }

  async updateMessage(req: Request, res: Response): Promise<void> {
    const { id: messageId } = req.params;
    const updateData = req.body as MessageUpdatePayload;
    const userId = req.user?.id;
    console.log(`PUT /api/messages/${messageId} - UserID: ${userId}, Payload:`, updateData);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized: User ID missing.' });
      return;
    }
    if (!isValidUUID(messageId)) {
      res.status(400).json({ error: 'Invalid message ID format.' });
      return;
    }
    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: 'No update data provided.' });
      return;
    }

    try {
      const updatedMessage = await this.messageService.updateMessage(messageId, updateData, userId);
      if (updatedMessage) {
        console.log(`PUT /api/messages/${messageId} - Response:`, updatedMessage);
        res.status(200).json(updatedMessage);
      } else {
        const exists = await this.messageService.getMessageById(messageId, userId);
        if (!exists) {
          console.log(`PUT /api/messages/${messageId} - Message not found.`);
          res
            .status(404)
            .json({ error: 'Message not found or you do not have permission to update it.' });
        } else {
          console.log(
            `PUT /api/messages/${messageId} - Message found but update failed or no change.`
          );
          res.status(400).json({ error: 'Update failed or no changes made.' });
        }
      }
    } catch (error: any) {
      console.error(`PUT /api/messages/${messageId} - Error:`, error.message);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof AuthError) {
        res.status(403).json({ error: error.message });
      } else if (error instanceof DatabaseError) {
        res.status(500).json({ error: 'Failed to update message.' });
      } else {
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }

  async deleteMessage(req: Request, res: Response): Promise<void> {
    const { id: messageId } = req.params;
    const userId = req.user?.id;
    console.log(`DELETE /api/messages/${messageId} - UserID: ${userId}`);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized: User ID missing.' });
      return;
    }
    if (!isValidUUID(messageId)) {
      res.status(400).json({ error: 'Invalid message ID format.' });
      return;
    }

    try {
      const deletedResult = await this.messageService.deleteMessage(messageId, userId);
      if (deletedResult) {
        console.log(`DELETE /api/messages/${messageId} - Message deleted successfully.`);
        res.status(204).send();
      } else {
        console.log(`DELETE /api/messages/${messageId} - Message not found or user lacks access.`);
        res
          .status(404)
          .json({ error: 'Message not found or you do not have permission to delete it.' });
      }
    } catch (error: any) {
      console.error(`DELETE /api/messages/${messageId} - Error:`, error.message);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof AuthError) {
        res.status(403).json({ error: error.message });
      } else if (error instanceof DatabaseError) {
        res.status(500).json({ error: 'Failed to delete message.' });
      } else {
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }
}

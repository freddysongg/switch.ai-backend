import { Request, Response } from 'express';
import { validate as isValidUUID } from 'uuid';

import { AuthError, DatabaseError, ValidationError } from '../db/errors';
import { ConversationService } from '../services/conversation';
import { ConversationCreatePayload, ConversationUpdatePayload } from '../types/conversation';

export class ConversationController {
  private conversationService: ConversationService;

  constructor() {
    this.conversationService = new ConversationService();
  }

  async createConversation(req: Request, res: Response): Promise<void> {
    const payload = req.body as ConversationCreatePayload;
    const userId = req.user?.id;
    console.log(`POST /api/conversations - UserID: ${userId}, Payload:`, payload);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized: User ID missing.' });
      return;
    }

    try {
      const newConversation = await this.conversationService.createConversation(payload, userId);
      console.log(`POST /api/conversations - Response:`, newConversation);
      res.status(201).json(newConversation);
    } catch (error: any) {
      console.error(`POST /api/conversations - Error:`, error.message);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof DatabaseError) {
        res.status(500).json({ error: 'Failed to create conversation.' });
      } else {
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }

  async getAllConversationsForUser(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    console.log(`GET /api/conversations - UserID: ${userId}`);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized: User ID missing.' });
      return;
    }

    try {
      const userConversations = await this.conversationService.getAllConversationsForUser(userId);
      console.log(
        `GET /api/conversations - Response count for user ${userId}:`,
        userConversations.length
      );
      res.status(200).json(userConversations);
    } catch (error: any) {
      console.error(`GET /api/conversations - Error:`, error.message);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof DatabaseError) {
        res.status(500).json({ error: 'Failed to retrieve conversations.' });
      } else {
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }

  async getConversationById(req: Request, res: Response): Promise<void> {
    const { id: conversationId } = req.params;
    const userId = req.user?.id;
    console.log(`GET /api/conversations/${conversationId} - UserID: ${userId}`);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized: User ID missing.' });
      return;
    }
    if (!isValidUUID(conversationId)) {
      res.status(400).json({ error: 'Invalid conversation ID format.' });
      return;
    }

    try {
      const conversation = await this.conversationService.getConversationById(
        conversationId,
        userId
      );
      if (conversation) {
        console.log(`GET /api/conversations/${conversationId} - Response:`, conversation);
        res.status(200).json(conversation);
      } else {
        console.log(
          `GET /api/conversations/${conversationId} - Conversation not found or not owned by user.`
        );
        res
          .status(404)
          .json({ error: 'Conversation not found or you do not have permission to access it.' });
      }
    } catch (error: any) {
      console.error(`GET /api/conversations/${conversationId} - Error:`, error.message);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof DatabaseError) {
        res.status(500).json({ error: 'Failed to retrieve conversation.' });
      } else {
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }

  async updateConversation(req: Request, res: Response): Promise<void> {
    const { id: conversationId } = req.params;
    const updateData = req.body as ConversationUpdatePayload;
    const userId = req.user?.id;
    console.log(
      `PUT /api/conversations/${conversationId} - UserID: ${userId}, Payload:`,
      updateData
    );

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized: User ID missing.' });
      return;
    }
    if (!isValidUUID(conversationId)) {
      res.status(400).json({ error: 'Invalid conversation ID format.' });
      return;
    }
    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: 'No update data provided.' });
      return;
    }

    try {
      const updatedConversation = await this.conversationService.updateConversation(
        conversationId,
        updateData,
        userId
      );
      if (updatedConversation) {
        console.log(`PUT /api/conversations/${conversationId} - Response:`, updatedConversation);
        res.status(200).json(updatedConversation);
      } else {
        const exists = await this.conversationService.getConversationById(conversationId, userId);
        if (!exists) {
          console.log(
            `PUT /api/conversations/${conversationId} - Conversation not found or not owned by user.`
          );
          res
            .status(404)
            .json({ error: 'Conversation not found or you do not have permission to modify it.' });
        } else {
          res.status(404).json({ error: 'Conversation not found or no changes applied.' });
        }
      }
    } catch (error: any) {
      console.error(`PUT /api/conversations/${conversationId} - Error:`, error.message);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof AuthError) {
        res.status(403).json({ error: error.message });
      } else if (error instanceof DatabaseError) {
        res.status(500).json({ error: 'Failed to update conversation.' });
      } else {
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }

  async deleteConversation(req: Request, res: Response): Promise<void> {
    const { id: conversationId } = req.params;
    const userId = req.user?.id;
    console.log(`DELETE /api/conversations/${conversationId} - UserID: ${userId}`);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized: User ID missing.' });
      return;
    }
    if (!isValidUUID(conversationId)) {
      res.status(400).json({ error: 'Invalid conversation ID format.' });
      return;
    }

    try {
      const deletedResult = await this.conversationService.deleteConversation(
        conversationId,
        userId
      );
      if (deletedResult) {
        console.log(
          `DELETE /api/conversations/${conversationId} - Conversation deleted successfully.`
        );
        res.status(204).send();
      } else {
        console.log(
          `DELETE /api/conversations/${conversationId} - Conversation not found or not owned by user.`
        );
        res
          .status(404)
          .json({ error: 'Conversation not found or you do not have permission to delete it.' });
      }
    } catch (error: any) {
      console.error(`DELETE /api/conversations/${conversationId} - Error:`, error.message);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof AuthError) {
        res.status(403).json({ error: error.message });
      } else if (error instanceof DatabaseError) {
        if (error.message.includes('foreign key constraint')) {
          res.status(409).json({ error: `Cannot delete conversation: ${error.message}` });
        } else {
          res.status(500).json({ error: 'Failed to delete conversation.' });
        }
      } else {
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }
}

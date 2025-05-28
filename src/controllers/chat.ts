import { sql } from 'drizzle-orm';
import { Request, Response } from 'express';

import { getRandomResponse, mockConversations } from '../data/mockResponses';
import { db } from '../db';
import { analyticsEvents, arrayToVector, switches } from '../db/schema';
import { ChatService } from '../services/chat';
import { EmbeddingsService } from '../services/embeddings';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
  };
}

const chatService = new ChatService();
const embeddingsService = new EmbeddingsService();

export class ChatController {
  // Process new chat message
  async chat(req: AuthenticatedRequest, res: Response) {
    try {
      const { message, conversationId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }
      // // Record analytics event
      // await db.insert(analyticsEvents).values({
      //   userId,
      //   eventType: 'chat.message.sent',
      //   metadata: {
      //     conversationId,
      //     messageLength: message.length
      //   }
      // });

      // const response = await chatService.processMessage(userId, {
      //   message,
      //   conversationId
      // });

      // // Record assistant response analytics
      // await db.insert(analyticsEvents).values({
      //   userId,
      //   eventType: 'chat.message.received',
      //   metadata: {
      //     conversationId: response.id,
      //     messageLength: response.content.length,
      //     ...response.metadata
      //   }
      // });

      // For testing, just return a random response
      const response = getRandomResponse(conversationId);
      res.json(response);
    } catch (error) {
      console.error('Chat controller error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get conversation history
  async getConversation(req: AuthenticatedRequest, res: Response) {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // For testing, return empty messages array
      res.json([]);
    } catch (error) {
      console.error('Get conversation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // List user's conversations
  async listConversations(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // For testing, return mock conversations
      res.json(mockConversations);
    } catch (error) {
      console.error('List conversations error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Delete conversation
  async deleteConversation(req: AuthenticatedRequest, res: Response) {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // For testing, just return success
      res.status(204).send();
    } catch (error) {
      console.error('Delete conversation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Search messages using semantic search
  async searchMessages(req: AuthenticatedRequest, res: Response) {
    try {
      const { query, limit = 5 } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }

      // For testing, return empty results
      res.json([]);
    } catch (error) {
      console.error('Search messages error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Search mechanical switches using semantic search
  async searchSwitches(req: AuthenticatedRequest, res: Response) {
    try {
      const { query, limit = 5 } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query string is required' });
      }

      // For testing, return empty results
      res.json([]);
    } catch (error) {
      console.error('Search switches error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

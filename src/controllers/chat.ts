import { sql } from 'drizzle-orm';
import { Request, Response } from 'express';

import { db } from '../db';
import { analyticsEvents, arrayToVector, switches } from '../db/schema';
import { ChatService } from '../services/chat';
import { EmbeddingsService } from '../services/embeddings';

const chatService = new ChatService();
const embeddingsService = new EmbeddingsService();

export class ChatController {
  // Process new chat message
  async chat(req: Request, res: Response) {
    try {
      const { message, conversationId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Record analytics event
      await db.insert(analyticsEvents).values({
        userId,
        eventType: 'chat.message.sent',
        metadata: {
          conversationId,
          messageLength: message.length
        }
      });

      const response = await chatService.processMessage(userId, {
        message,
        conversationId
      });

      // Record assistant response analytics
      await db.insert(analyticsEvents).values({
        userId,
        eventType: 'chat.message.received',
        metadata: {
          conversationId: response.id,
          messageLength: response.content.length,
          ...response.metadata
        }
      });

      res.json(response);
    } catch (error) {
      console.error('Chat controller error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get conversation history
  async getConversation(req: Request, res: Response) {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const messages = await chatService.getConversation(userId, conversationId);
      res.json(messages);
    } catch (error) {
      console.error('Get conversation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // List user's conversations
  async listConversations(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const conversations = await chatService.listConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error('List conversations error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Delete conversation
  async deleteConversation(req: Request, res: Response) {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      await chatService.deleteConversation(userId, conversationId);

      // Record analytics
      await db.insert(analyticsEvents).values({
        userId,
        eventType: 'conversation.deleted',
        metadata: { conversationId }
      });

      res.status(204).send();
    } catch (error) {
      console.error('Delete conversation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Search messages using semantic search
  async searchMessages(req: Request, res: Response) {
    try {
      const { query, limit = 5 } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }

      const results = await embeddingsService.searchSimilar(query, limit);

      // Record search analytics
      await db.insert(analyticsEvents).values({
        userId,
        eventType: 'chat.messages.searched',
        metadata: {
          query,
          resultCount: results.length
        }
      });

      res.json(results);
    } catch (error) {
      console.error('Search messages error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Search mechanical switches using semantic search
  async searchSwitches(req: Request, res: Response) {
    try {
      const { query, limit = 5 } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query string is required' });
      }

      // Generate embedding for search query
      const queryEmbedding = await embeddingsService.generateEmbedding(query);

      // Search switches using vector similarity
      const results = await db.execute(sql`
        SELECT *,
          1 - (${arrayToVector(queryEmbedding)} <=> embedding) as similarity
        FROM ${switches}
        ORDER BY similarity DESC
        LIMIT ${limit}
      `);

      // Record search analytics
      await db.insert(analyticsEvents).values({
        userId,
        eventType: 'switches.searched',
        metadata: {
          query,
          resultCount: results.length
        }
      });

      res.json(results);
    } catch (error) {
      console.error('Search switches error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

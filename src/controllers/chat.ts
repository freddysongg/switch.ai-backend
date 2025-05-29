import { sql } from 'drizzle-orm';
import { Request, Response } from 'express';

import { AI_CONFIG } from '../config/ai.config';
import { arrayToVector, db } from '../db';
import { ChatService } from '../services/chat';
import { LocalEmbeddingService } from '../services/embeddingsLocal';

const chatService = new ChatService();
const localEmbeddingService = new LocalEmbeddingService();

export class ChatController {
  async chat(req: Request, res: Response): Promise<void> {
    try {
      const { message, conversationId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!message || typeof message !== 'string' || message.trim() === '') {
        res.status(400).json({ error: 'Message is required and must be a non-empty string.' });
        return;
      }

      const responseData = await chatService.processMessage(userId, {
        message,
        conversationId
      });

      if (responseData.metadata?.error) {
        console.error('ChatService processed with error:', responseData.metadata.details);
        res.status(500).json({
          id: responseData.id,
          role: 'assistant',
          content: AI_CONFIG.FALLBACK_ERROR_MESSAGE_INTERNAL,
          metadata: { error: true }
        });
        return;
      }

      res.json(responseData);
    } catch (error: any) {
      console.error('Critical Chat controller error:', error.message || error, error.stack);
      // Check if headers have already been sent before trying to send another response
      if (!res.headersSent) {
        res.status(500).json({
          id: `ctrl-error-${Date.now()}`,
          role: 'assistant',
          content: AI_CONFIG.FALLBACK_ERROR_MESSAGE_INTERNAL,
          metadata: { error: true, details: 'Unexpected error in chat processing.' }
        });
      }
    }
  }

  async getConversation(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!conversationId) {
        res.status(400).json({ error: 'Conversation ID is required.' });
        return;
      }

      const history = await chatService.getConversation(userId, conversationId);
      res.json(history);
    } catch (error: any) {
      console.error('Get conversation error:', error.message || error);
      if (
        error.message?.toLowerCase().includes('not found') ||
        error.message?.toLowerCase().includes('access denied')
      ) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error while fetching conversation.' });
      }
    }
  }

  async listConversations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const conversationList = await chatService.listConversations(userId);
      res.json(conversationList);
    } catch (error: any) {
      console.error('List conversations error:', error.message || error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error while listing conversations.' });
      }
    }
  }

  async deleteConversation(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!conversationId) {
        res.status(400).json({ error: 'Conversation ID is required.' });
        return;
      }

      await chatService.deleteConversation(userId, conversationId);
      res.status(204).send();
    } catch (error: any) {
      console.error('Delete conversation error:', error.message || error);
      if (error.message?.toLowerCase().includes('not found')) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error while deleting conversation.' });
      }
    }
  }

  async searchSwitches(req: Request, res: Response): Promise<void> {
    try {
      const { query } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query string is required' });
        return;
      }

      const queryEmbedding = await localEmbeddingService.embedText(query);
      const limit = parseInt(req.query.limit as string, 10) || AI_CONFIG.CONTEXT_RESULTS_COUNT;

      const results = await db.execute<any>(sql`
        SELECT 
          s.id, s.name, s.manufacturer, s.type,
          (s.name || ' (' || s.manufacturer || ')') as "displayText", 
          1 - (s.embedding::vector <=> ${arrayToVector(queryEmbedding)}::vector) AS similarity
        FROM switches AS s
        ORDER BY similarity DESC
        LIMIT ${limit}
      `);

      res.json(
        results.filter(
          (r: any) => r.similarity != null && r.similarity >= AI_CONFIG.SIMILARITY_THRESHOLD
        )
      );
    } catch (error: any) {
      console.error('Search switches controller error:', error.message || error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error during switch search.' });
      }
    }
  }

  async searchMessages(req: Request, res: Response): Promise<void> {
    if (!res.headersSent) {
      res.status(501).json({ message: 'Message search feature not implemented yet.' });
    }
  }
}

import { sql } from 'drizzle-orm';
import { Request, Response } from 'express';

import { AI_CONFIG } from '../config/ai.config';
import { arrayToVector, db } from '../db';
import { ChatService } from '../services/chat';
import { LocalEmbeddingService } from '../services/embeddingsLocal';

const chatService = new ChatService();
const localEmbeddingService = new LocalEmbeddingService();

export class ChatController {
  async chat(req: Request, res: Response) {
    try {
      const { message, conversationId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!message || typeof message !== 'string' || message.trim() === '') {
        return res
          .status(400)
          .json({ error: 'Message is required and must be a non-empty string.' });
      }

      const response = await chatService.processMessage(userId, {
        message,
        conversationId
      });

      if (response.metadata?.error) {
        console.error('ChatService processed with error:', response.metadata.details);
        return res.status(500).json({
          id: response.id,
          role: 'assistant',
          content: AI_CONFIG.FALLBACK_ERROR_MESSAGE_INTERNAL,
          metadata: { error: true }
        });
      }

      res.json(response);
    } catch (error: any) {
      console.error('Critical Chat controller error:', error.message || error, error.stack);
      res.status(500).json({
        id: `ctrl-error-${Date.now()}`,
        role: 'assistant',
        content: AI_CONFIG.FALLBACK_ERROR_MESSAGE_INTERNAL,
        metadata: { error: true, details: 'Unexpected error in chat processing.' }
      });
    }
  }

  async getConversation(req: Request, res: Response) {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.id;

      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!conversationId) return res.status(400).json({ error: 'Conversation ID is required.' });

      const history = await chatService.getConversation(userId, conversationId);
      res.json(history);
    } catch (error: any) {
      console.error('Get conversation error:', error.message || error);
      if (
        error.message?.toLowerCase().includes('not found') ||
        error.message?.toLowerCase().includes('access denied')
      ) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error while fetching conversation.' });
    }
  }

  async listConversations(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const conversationList = await chatService.listConversations(userId);
      res.json(conversationList);
    } catch (error: any) {
      console.error('List conversations error:', error.message || error);
      res.status(500).json({ error: 'Internal server error while listing conversations.' });
    }
  }

  async deleteConversation(req: Request, res: Response) {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.id;

      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!conversationId) return res.status(400).json({ error: 'Conversation ID is required.' });

      await chatService.deleteConversation(userId, conversationId);
      res.status(204).send();
    } catch (error: any) {
      console.error('Delete conversation error:', error.message || error);
      if (error.message?.toLowerCase().includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error while deleting conversation.' });
    }
  }

  // This endpoint allows direct search for switches, separate from conversational RAG.
  async searchSwitches(req: Request, res: Response) {
    try {
      const { query } = req.query; // query params are strings
      const userId = req.user?.id; // Auth check
      // const limit = parseInt(req.query.limit as string, 10) || AI_CONFIG.CONTEXT_RESULTS_COUNT;

      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!query || typeof query !== 'string')
        return res.status(400).json({ error: 'Query string is required' });

      // This uses LocalEmbeddingService for semantic search on switches table
      // Need a method in LocalEmbeddingService or direct DB call here similar to ChatService's RAG.
      // For consistency, let's assume LocalEmbeddingService could be extended or we adapt ChatService logic.
      // For this example, we'll construct a simplified direct search.
      // This is similar to the RAG context retrieval step in ChatService.
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

      res.json(results.filter((r) => r.similarity >= AI_CONFIG.SIMILARITY_THRESHOLD));
    } catch (error: any) {
      console.error('Search switches controller error:', error.message || error);
      res.status(500).json({ error: 'Internal server error during switch search.' });
    }
  }

  // searchMessages endpoint would require similar logic if searching message embeddings
  async searchMessages(req: Request, res: Response) {
    // Placeholder - implement if message-specific semantic search is needed
    res.status(501).json({ message: 'Message search feature not implemented yet.' });
  }
}

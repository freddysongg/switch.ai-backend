import { db } from '@/db';
import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import { eq, sql } from 'drizzle-orm';

import { messageEmbeddings, messages, vectorFromJson } from '@/db/schema';

let genAI: GoogleGenerativeAI | null = null;
let embeddingModel: GenerativeModel | null = null;

if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  embeddingModel = genAI.getGenerativeModel({ model: 'embedding-001' });
} else {
  console.warn('Warning: GEMINI_API_KEY not defined, embeddings features will be unavailable');
}

export type SearchResult = Record<string, unknown> & {
  id: string;
  conversationId: string;
  userId: string;
  content: string;
  role: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  similarity: number;
};

export class EmbeddingsService {
  // Generate embeddings for a text
  async generateEmbedding(text: string): Promise<number[]> {
    if (!embeddingModel) {
      throw new Error('Embedding model not available');
    }

    try {
      const result = await embeddingModel.embedContent(text);
      const embedding = result.embedding;
      return embedding.values;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  // Store embeddings for a message
  async createEmbedding(messageId: string, content: string) {
    try {
      const embedding = await this.generateEmbedding(content);

      await db.insert(messageEmbeddings).values({
        messageId,
        embedding
      });
    } catch (error) {
      console.error('Failed to create embedding:', error);
      throw error;
    }
  }

  // Search for similar messages
  async searchSimilar(query: string, limit: number = 5): Promise<SearchResult[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);

      // Search using cosine similarity with proper casting
      const results = await db.execute<SearchResult>(sql`
        SELECT m.*, 
          1 - (${vectorFromJson(queryEmbedding)} <=> cast(e.embedding::jsonb as vector)) as similarity
        FROM ${messageEmbeddings} e
        JOIN ${messages} m ON m.id = e.message_id
        ORDER BY similarity DESC
        LIMIT ${limit}
      `);

      return results;
    } catch (error) {
      console.error('Failed to search similar messages:', error);
      throw error;
    }
  }

  // Delete embeddings for a message
  async deleteEmbedding(messageId: string) {
    try {
      await db.delete(messageEmbeddings).where(eq(messageEmbeddings.messageId, messageId));
    } catch (error) {
      console.error('Failed to delete embedding:', error);
      throw error;
    }
  }
}

export const embeddingsService = new EmbeddingsService();

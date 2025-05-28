import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '../db';
import { conversations, messageEmbeddings, messages } from '../db/schema';
import { ChatMessage, ChatRequest, ChatResponse } from '../interfaces/chat';
import { EmbeddingsService } from './embeddings';

// Constants for chat configuration
const MAX_HISTORY_MESSAGES = 10;
const MAX_MESSAGE_LENGTH = 32000;
const MAX_CONTEXT_LENGTH = 128000;

// Gemini key is optional for now
let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;
const embeddingsService = new EmbeddingsService();

if (process.env.GOOGLE_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  model = genAI.getGenerativeModel({
    model: 'gemini-pro',
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.7,
      topP: 0.8,
      topK: 40
    }
  });
} else {
  console.warn('Warning: GOOGLE_API_KEY not defined, LLM features will be unavailable');
}

export class ChatService {
  // Helper to truncate text while preserving word boundaries
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    const truncated = text.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    return truncated.slice(0, lastSpace) + '...';
  }

  // Helper to get recent conversation history
  private async getConversationHistory(
    conversationId: string,
    limit = MAX_HISTORY_MESSAGES
  ): Promise<ChatMessage[]> {
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    return msgs.reverse().map((msg) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      metadata: msg.metadata as Record<string, any>,
      createdAt: msg.createdAt
    }));
  }

  // Process a new chat message
  async processMessage(userId: string, request: ChatRequest): Promise<ChatResponse> {
    const { message: rawMessage, conversationId } = request;
    const message = this.truncateText(rawMessage, MAX_MESSAGE_LENGTH);

    try {
      if (!model) {
        throw new Error('LLM service is not available');
      }

      // Get or create conversation
      let conversation;
      if (conversationId) {
        const [existing] = await db
          .select()
          .from(conversations)
          .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
          .limit(1);

        if (!existing) {
          throw new Error('Conversation not found or unauthorized');
        }
        conversation = existing;
      } else {
        const [created] = await db
          .insert(conversations)
          .values({
            userId,
            title: this.truncateText(message, 100),
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();

        conversation = created;
      }

      // Save user message
      const [userMessage] = await db
        .insert(messages)
        .values({
          conversationId: conversation.id,
          userId,
          content: message,
          role: 'user',
          createdAt: new Date()
        })
        .returning();

      try {
        // Create embeddings for semantic search
        await embeddingsService.createEmbedding(userMessage.id, message);
      } catch (error) {
        console.warn('Failed to create embedding, continuing without semantic search:', error);
      }

      // Get conversation history
      const history = await this.getConversationHistory(conversation.id);

      // Find relevant messages using semantic search
      let relevantContext: ChatMessage[] = [];
      try {
        const similarMessages = await embeddingsService.searchSimilar(message, 3);
        relevantContext = similarMessages
          .filter((msg) => msg.conversationId !== conversation.id)
          .filter((msg) => msg.similarity > 0.7)
          .map((msg) => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            metadata: msg.metadata || {},
            createdAt: msg.createdAt
          }));
      } catch (error) {
        console.warn('Failed to fetch similar messages, continuing without context:', error);
      }

      // Prepare chat history for the model
      const chatHistory = [...history, ...relevantContext].map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      // Start chat with history
      const chat = model.startChat({
        history: chatHistory,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
          topP: 0.8,
          topK: 40
        }
      });

      // Get response with timeout
      const responsePromise = chat.sendMessage(message);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Response timeout')), 30000);
      });

      let text: string;
      try {
        const result = await Promise.race([responsePromise, timeoutPromise]);
        const response = await (result as any).response;
        text = response.text();
      } catch (error) {
        console.error('LLM response error:', error);
        text =
          "I apologize, but I'm having trouble generating a response right now. Please try again in a moment.";
      }

      // Save assistant message
      const [assistantMessage] = await db
        .insert(messages)
        .values({
          conversationId: conversation.id,
          userId,
          content: text,
          role: 'assistant',
          metadata: {
            model: 'gemini-pro'
          },
          createdAt: new Date()
        })
        .returning();

      // Update conversation timestamp
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversation.id));

      // Create embeddings for the assistant's response
      try {
        await embeddingsService.createEmbedding(assistantMessage.id, text);
      } catch (error) {
        console.warn('Failed to create embedding for response:', error);
      }

      return {
        id: assistantMessage.id,
        role: 'assistant',
        content: text,
        metadata: assistantMessage.metadata as Record<string, any>
      };
    } catch (error) {
      console.error('Chat processing error:', error);
      throw error;
    }
  }

  // Get conversation history
  async getConversation(userId: string, conversationId: string): Promise<ChatMessage[]> {
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    return history.map((msg) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      metadata: msg.metadata as Record<string, any> | undefined,
      createdAt: msg.createdAt
    }));
  }

  // List user's conversations
  async listConversations(userId: string) {
    return db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(conversations.updatedAt);
  }

  // Delete a conversation
  async deleteConversation(userId: string, conversationId: string) {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId) && eq(conversations.userId, userId))
      .limit(1);

    if (!conversation) {
      throw new Error('Conversation not found or unauthorized');
    }

    // Get all message IDs for this conversation
    const messageIds = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));

    // Delete associated messages and embeddings
    await Promise.all([
      db.delete(messages).where(eq(messages.conversationId, conversationId)),
      ...messageIds.map(({ id }) => embeddingsService.deleteEmbedding(id))
    ]);

    await db.delete(conversations).where(eq(conversations.id, conversationId));
  }
}

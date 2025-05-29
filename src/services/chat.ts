import { and, desc, eq, sql } from 'drizzle-orm';

import { AI_CONFIG } from '../config/ai.config.js';
import { arrayToVector, db, withDb } from '../db/index.js';
import {
  conversations,
  messages as messagesTable,
  switches as switchesTable
} from '../db/schema.js';
import { ChatRequest, ChatResponse, ChatMessage as UIChatMessage } from '../types/chat.js';
import { LocalEmbeddingService } from './embeddingsLocal.js';
import { GeminiService } from './gemini.js';
import { PromptBuilder } from './promptBuilder.js';

interface SwitchContextForPrompt {
  [key: string]: unknown;
  name: string;
  manufacturer: string;
  type: string | null;
  spring: string | null;
  actuationForce: number | null;
  description_text?: string;
  similarity?: number;
}

const embeddingService = new LocalEmbeddingService();
const geminiService = new GeminiService();

export class ChatService {
  private truncateText(text: string, max: number): string {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const lastSpaceIndex = cut.lastIndexOf(' ');
    return (lastSpaceIndex > 0 ? cut.slice(0, lastSpaceIndex) : cut) + '...';
  }

  // Fetches history messages formatted for the prompt builder
  private async getConversationHistoryForPrompt(
    conversationId: string
  ): Promise<Pick<UIChatMessage, 'role' | 'content'>[]> {
    const dbMessages = await db
      .select({
        role: messagesTable.role,
        content: messagesTable.content
      })
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(desc(messagesTable.createdAt))
      .limit(AI_CONFIG.CHAT_HISTORY_MAX_TURNS * 2);

    return dbMessages.reverse().map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }));
  }

  /** Full RAG-powered message processing */
  async processMessage(userId: string, request: ChatRequest): Promise<ChatResponse> {
    const rawUserQuery = this.truncateText(request.message, AI_CONFIG.MAX_OUTPUT_TOKENS * 100);

    try {
      // 1) Get or create conversation
      let conversation = await withDb(async () => {
        if (request.conversationId) {
          const [existing] = await db
            .select()
            .from(conversations)
            .where(
              and(eq(conversations.id, request.conversationId), eq(conversations.userId, userId))
            )
            .limit(1);
          if (!existing) throw new Error('Conversation not found or unauthorized');
          return existing;
        }
        const [created] = await db
          .insert(conversations)
          .values({
            userId,
            title: this.truncateText(rawUserQuery, 100),
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        return created;
      });
      const currentConversationId = conversation.id;

      // 2) Save user message
      await db
        .insert(messagesTable)
        .values({
          conversationId: currentConversationId,
          userId,
          content: rawUserQuery,
          role: 'user',
          createdAt: new Date(),
          timestamp: new Date()
        })
        .returning();

      // 3) Embed the user query
      const queryEmbedding = await embeddingService.embedText(rawUserQuery);
      const queryEmbeddingSql = arrayToVector(queryEmbedding);

      // 4) Retrieve top-K context from switches table
      const retrievedRawContexts = await db.execute<
        SwitchContextForPrompt & { similarity: number }
      >(sql`
        SELECT 
          s.name, 
          s.manufacturer, 
          s.type,
          s.spring,
          s.actuation_force as "actuationForce",
          (s.name || ' is a ' || COALESCE(s.type, 'N/A') || ' switch by ' || s.manufacturer || 
           '. It has a spring type of ' || COALESCE(s.spring, 'N/A') || 
           ' and an actuation force of ' || COALESCE(CAST(s.actuation_force AS TEXT), 'N/A') || 'g.' ||
           ' Top housing: ' || COALESCE(s.top_housing, 'N/A') || ', Bottom housing: ' || COALESCE(s.bottom_housing, 'N/A') || ', Stem: ' || COALESCE(s.stem, 'N/A') ||'.'
          ) as description_text,
          1 - ((s.embedding::text)::vector <=> ${queryEmbeddingSql}) AS similarity
        FROM ${switchesTable} AS s
        ORDER BY similarity DESC
        LIMIT ${AI_CONFIG.CONTEXT_RESULTS_COUNT}
      `);

      const switchContextsForPrompt = retrievedRawContexts.filter(
        (c) => c.similarity != null && c.similarity >= AI_CONFIG.SIMILARITY_THRESHOLD
      );

      // 5) Fetch recent history
      const historyForPrompt = await this.getConversationHistoryForPrompt(currentConversationId);

      // 6) Build prompt using the new PromptBuilder and structured config
      const prompt = PromptBuilder.buildPrompt(
        historyForPrompt,
        switchContextsForPrompt,
        rawUserQuery
      );

      // 7) Call Gemini
      const assistantText = await geminiService.generate(prompt);

      // 8) Save assistant response
      const [assistantMsgRecord] = await db
        .insert(messagesTable)
        .values({
          conversationId: currentConversationId,
          userId,
          content: assistantText,
          role: 'assistant',
          metadata: {
            model: AI_CONFIG.GEMINI_MODEL,
            promptLength: prompt.length,
            contextItems: switchContextsForPrompt.length
          },
          createdAt: new Date(),
          timestamp: new Date()
        })
        .returning();

      // 9) Update conversation timestamp
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, currentConversationId));

      return {
        id: assistantMsgRecord.id,
        role: 'assistant',
        content: assistantText,
        metadata: assistantMsgRecord.metadata as Record<string, any>
      };
    } catch (error: any) {
      console.error(
        'Error processing message in ChatService:',
        error.message,
        error.cause || error.stack
      );
      if (error.cause && error.cause.query) {
        console.error('Failed Drizzle Query:', error.cause.query);
        console.error('Failed Drizzle Params:', error.cause.params);
      }
      return {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: AI_CONFIG.FALLBACK_ERROR_MESSAGE_INTERNAL,
        metadata: { error: true, details: error.message }
      };
    }
  }

  async getConversation(userId: string, conversationId: string): Promise<UIChatMessage[]> {
    const [convoCheck] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .limit(1);
    if (!convoCheck) {
      throw new Error('Conversation not found or access denied.');
    }

    const history = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(messagesTable.timestamp);

    return history.map((msg) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      metadata: msg.metadata as Record<string, any> | undefined,
      createdAt: msg.timestamp
    }));
  }

  async listConversations(userId: string) {
    return db
      .select({
        id: conversations.id,
        userId: conversations.userId,
        title: conversations.title,
        category: conversations.category,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt
      })
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt));
  }

  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    const [conversation] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .limit(1);

    if (!conversation) {
      throw new Error('Conversation not found or unauthorized to delete.');
    }
    await db.delete(messagesTable).where(eq(messagesTable.conversationId, conversationId));
    await db.delete(conversations).where(eq(conversations.id, conversationId));
  }
}

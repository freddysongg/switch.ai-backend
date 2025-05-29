import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import { messages } from '@/db/schema';

export type Message = InferSelectModel<typeof messages>;
export type NewMessage = InferInsertModel<typeof messages>;

export interface MessageCreatePayload {
  content: string;
  role: 'user' | 'assistant' | string;
  category?: string | null;
  metadata?: Record<string, any> | null;
}

export interface MessageUpdatePayload {
  content?: string;
  role?: 'user' | 'assistant' | string;
  category?: string | null;
  metadata?: Record<string, any> | null;
}

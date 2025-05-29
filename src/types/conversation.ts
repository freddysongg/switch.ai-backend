import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import { conversations } from '../db/schema.js';

export type Conversation = InferSelectModel<typeof conversations>;
export type NewConversation = InferInsertModel<typeof conversations>;

export interface ConversationCreatePayload {
  userId: string;
  title?: string | null;
  category?: string | null;
}

export interface ConversationUpdatePayload {
  title?: string | null;
  category?: string | null;
}

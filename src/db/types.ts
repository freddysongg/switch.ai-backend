import { InferSelectModel } from 'drizzle-orm';

import * as schema from './schema';

export type User = InferSelectModel<typeof schema.users>;
export type Conversation = InferSelectModel<typeof schema.conversations>;
export type Message = InferSelectModel<typeof schema.messages>;
export type MessageEmbedding = InferSelectModel<typeof schema.messageEmbeddings>;
export type RateLimit = InferSelectModel<typeof schema.rateLimits>;
export type AnalyticsEvent = InferSelectModel<typeof schema.analyticsEvents>;

// Database interface
export interface Database {
  users: User[];
  conversations: Conversation[];
  messages: Message[];
  message_embeddings: MessageEmbedding[];
  rate_limits: RateLimit[];
  analytics_events: AnalyticsEvent[];
}

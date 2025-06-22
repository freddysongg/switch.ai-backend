export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  userId: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
}

export interface ChatResponse {
  id: string;
  role: 'assistant';
  content: string;
  metadata?: Record<string, any>;
  comparisonTable?: Record<string, any>;
  summary?: string;
  recommendations?: Recommendation[];
  switches?: SwitchWithRelevanceInfo[];
}

export interface RateLimit {
  userId: string;
  endpoint: string;
  count: number;
  resetAt: Date;
}

export interface AnalyticsEvent {
  userId?: string;
  eventType: string;
  metadata: Record<string, any>;
}

export interface User {
  id: string;
  app_metadata?: Record<string, any>;
  user_metadata?: Record<string, any>;
  aud?: string;
  created_at?: string;
}

export interface SwitchWithRelevanceInfo {
  name: string;
  manufacturer: string;
  type: string | null;
  relevance_score?: number;
  justification?: string;
}

export interface Recommendation {
  text: string;
  reasoning: string;
}

export interface StructuredComparisonResponse {
  comparisonTable: Record<string, any>;
  summary: string;
  recommendations: Recommendation[];
}

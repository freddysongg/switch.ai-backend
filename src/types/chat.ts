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

// Chat request/response interfaces
export interface ChatRequest {
  message: string;
  conversationId?: string;
}

export interface ChatResponse {
  id: string;
  role: 'assistant';
  content: string;
  metadata?: Record<string, any>;
}

// Rate limiting interfaces
export interface RateLimit {
  userId: string;
  endpoint: string;
  count: number;
  resetAt: Date;
}

// Analytics interfaces
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

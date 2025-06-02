import {
  SwitchComparisonResponse,
  CharacteristicsExplanationResponse,
  MaterialAnalysisResponse,
  StandardRAGResponse
} from '../config/responseStructures.js';

/**
 * Structured content interface to replace simple string content
 * Supports multiple response types with structured JSON data
 */
export interface StructuredContent {
  responseType: 'switch_comparison' | 'characteristics_explanation' | 'material_analysis' | 'standard_rag';
  data: SwitchComparisonResponse | CharacteristicsExplanationResponse | MaterialAnalysisResponse | StandardRAGResponse;
  version: string; 
  generatedAt: Date;
  metadata?: Record<string, any>;
  error?: {
    errorType: string;
    errorMessage: string;
    timestamp: string;
    markdownLength: number;
    hasBasicStructure?: any;
  };
  isFallback?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: StructuredContent | string; 
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
  content: StructuredContent | string; 
  metadata?: Record<string, any>;
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

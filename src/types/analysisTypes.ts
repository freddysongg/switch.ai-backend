/**
 * Shared TypeScript types for the LLM-Powered Switch Analysis Feature
 *
 * This file contains types for internal data structures, requests, processing,
 * and workflow management across the analysis feature.
 */

// Import response structure from the main definition
import { AnalysisError, AnalysisResponse } from '../config/responseStructure.js';

// ============================================================================
// QUERY PROCESSING TYPES (FR1)
// ============================================================================

// Enhanced request interface for comprehensive query processing (FR1.1)
export interface AnalysisRequest {
  // Core query fields
  query: string;
  conversationId?: string;
  userId?: string;

  // Follow-up context for maintaining conversation flow (FR3.4)
  followUpContext?: {
    previousQuery?: string;
    previousResponse?: Partial<AnalysisResponse>;
    conversationHistory?: Array<{
      query: string;
      response: string;
      timestamp: Date;
    }>;
  };

  // User preferences and options
  preferences?: {
    detailLevel?: 'brief' | 'moderate' | 'detailed';
    technicalDepth?: 'basic' | 'intermediate' | 'advanced';
    includeRecommendations?: boolean;
    maxSwitchesInComparison?: number;
    preferredResponseSections?: string[];
    focusAreas?: string[];
  };

  // Request metadata and tracking
  requestId: string;
  timestamp: Date;
  source?: 'web' | 'api' | 'mobile';

  // Optional query hints and constraints
  queryHints?: {
    expectedIntent?: QueryIntent;
    switchNames?: string[];
    materials?: string[];
    comparisonType?: 'detailed' | 'quick';
  };

  // Additional metadata
  metadata?: Record<string, any>;
}

// Request body interface for API endpoints (what comes from HTTP requests)
export interface AnalysisRequestBody {
  query: string;
  conversationId?: string;
  followUpContext?: AnalysisRequest['followUpContext'];
  preferences?: AnalysisRequest['preferences'];
  queryHints?: AnalysisRequest['queryHints'];
  source?: string;
  metadata?: Record<string, any>;
}

// Intent recognition types (FR1.2)
export type QueryIntent =
  | 'general_switch_info'
  | 'switch_comparison'
  | 'material_analysis'
  | 'follow_up_question'
  | 'unknown';

export interface IntentRecognitionResult {
  intent: QueryIntent;
  category: QueryIntent; // Alias for intent to support both naming conventions
  confidence: number;
  extractedEntities: {
    switches: string[];
    materials: string[];
    properties: string[];
    comparisonType?: string;
    questionType?: string;
  };
  entities: {
    switches?: string[];
    materials?: string[];
    properties?: string[];
    focusAreas?: string[];
    primarySwitch?: string;
    comparisonSwitches?: string[];
  };
  reasoning?: string;
  alternatives?: Array<{
    intent: QueryIntent;
    confidence: number;
  }>;
}

// ============================================================================
// DATABASE INTERACTION TYPES (FR2)
// ============================================================================

// Switch data from database (matches identity.txt structure)
export interface DatabaseSwitchData {
  switchName: string;
  manufacturer?: string;
  type?: string;
  topHousing?: string;
  bottomHousing?: string;
  stem?: string;
  mount?: string;
  spring?: string;
  actuationForceG?: number;
  bottomOutForceG?: number;
  preTravelMm?: number;
  totalTravelMm?: number;
  factoryLubed?: boolean;
  additionalNotesDb?: string;
}

export interface DatabaseLookupResult {
  found: boolean;
  data?: DatabaseSwitchData;
  normalizedName: string;
  confidence: number;
}

export interface DatabaseContext {
  switches: DatabaseLookupResult[];
  totalFound: number;
  totalRequested: number;
}

export interface EnhancedDatabaseContext extends DatabaseContext {
  dataQuality: {
    overallCompleteness: number;
    switchesWithIncompleteData: string[];
    switchesNotFound: string[];
    hasAnyData: boolean;
    recommendLLMFallback: boolean;
  };
  usage: {
    successfulLookups: number;
    failedLookups: number;
    lowConfidenceLookups: number;
    incompleteDataCount: number;
  };
}

// ============================================================================
// LLM INTERACTION TYPES (FR3, TC4)
// ============================================================================

export interface LLMPromptContext {
  query: string;
  intent: IntentRecognitionResult;
  databaseContext: EnhancedDatabaseContext;
  preferences?: AnalysisRequest['preferences'];
  followUpContext?: AnalysisRequest['followUpContext'];
  requestMetadata?: AnalysisRequest['metadata'];
  responseStructureGuide?: string;
  personaInstructions?: string;
  conversationHistory?: string[];
}

export interface LLMRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
}

export interface LLMResponse {
  content: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
}

// ============================================================================
// PROCESSING WORKFLOW TYPES
// ============================================================================

export interface ProcessingStep {
  stepName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  data?: any;
  error?: string;
}

export interface AnalysisWorkflow {
  requestId: string;
  userQuery: string;
  steps: {
    intentRecognition: ProcessingStep;
    databaseLookup: ProcessingStep;
    promptConstruction: ProcessingStep;
    llmGeneration: ProcessingStep;
    responseValidation: ProcessingStep;
  };
  startTime: Date;
  endTime?: Date;
  totalDurationMs?: number;
}

export interface WorkflowStep {
  stepName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  result?: any;
  error?: string;
}

export interface Workflow {
  workflowId: string;
  requestId: string;
  userQuery: string;
  steps: Map<string, WorkflowStep>;
  startTime: Date;
  endTime?: Date;
  totalDurationMs?: number;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface AnalysisConfig {
  llm: {
    model: string;
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
  };
  database: {
    maxLookups: number;
    fuzzyMatchThreshold: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    logSteps: boolean;
    logPrompts: boolean;
    logResponses: boolean;
  };
}

// ============================================================================
// LOGGING TYPES (FR5)
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  step: string;
  message: string;
  data?: any;
  requestId?: string;
  userId?: string;
}

export interface StepLog {
  step: string;
  action: string;
  details: string;
  data?: any;
  timestamp: Date;
}

// ============================================================================
// ERROR HANDLING TYPES (FR6)
// ============================================================================

// Note: AnalysisError is imported from responseStructure.ts

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  hasRequiredFields: boolean;
  structureCompliance: number; // 0-1 score
}

// ============================================================================
// UTILITIES
// ============================================================================

export interface NormalizationResult {
  original: string;
  normalized: string;
  confidence: number;
  suggestions: string[];
}

// Re-export AnalysisResponse from the main definition
export { AnalysisResponse, AnalysisError };

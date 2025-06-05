/**
 * Error Handler Utility for SwitchAI Response Quality Enhancement
 *
 * Following intentMapping.ts success patterns:
 * - Single source of truth for error classification
 * - Deterministic error handling with fallbacks
 * - Comprehensive input handling with graceful degradation
 * - Clear type safety with TypeScript interfaces
 *
 * Purpose: Handle API errors, intent failures, database errors, and format recovery
 * while maintaining markdown structure requirements (Task 3.4)
 */

import { AnalysisResponse, QueryIntent } from '../types/analysisTypes.js';

export interface ErrorClassification {
  type: ErrorType;
  severity: ErrorSeverity;
  recoverable: boolean;
  fallbackStrategy: FallbackStrategy;
  message: string;
  context?: any;
}

export type ErrorType =
  | 'api_quota_exceeded'
  | 'api_service_unavailable'
  | 'api_network_error'
  | 'intent_recognition_failed'
  | 'database_connection_error'
  | 'database_query_failed'
  | 'format_validation_failed'
  | 'response_generation_failed'
  | 'unknown_error';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type FallbackStrategy =
  | 'retry_with_backoff'
  | 'offline_knowledge_fallback'
  | 'rule_based_intent_fallback'
  | 'database_fallback'
  | 'format_recovery'
  | 'graceful_degradation'
  | 'system_maintenance_response';

/**
 * Main error classification function
 * Following intentMapping's deterministic pattern
 */
export function classifyError(error: any, context?: any): ErrorClassification {
  if (error?.message?.includes('429 Too Many Requests')) {
    return {
      type: 'api_quota_exceeded',
      severity: 'high',
      recoverable: true,
      fallbackStrategy: 'offline_knowledge_fallback',
      message: 'API quota exceeded, using offline knowledge base',
      context: { retryAfter: extractRetryDelay(error.message) }
    };
  }

  if (error?.message?.includes('503 Service Unavailable')) {
    return {
      type: 'api_service_unavailable',
      severity: 'high',
      recoverable: true,
      fallbackStrategy: 'retry_with_backoff',
      message: 'API service temporarily unavailable',
      context: { maxRetries: 3, backoffMs: 5000 }
    };
  }

  if (error?.message?.includes('No JSON object found in LLM response')) {
    return {
      type: 'intent_recognition_failed',
      severity: 'medium',
      recoverable: true,
      fallbackStrategy: 'rule_based_intent_fallback',
      message: 'Intent recognition failed, using rule-based fallback',
      context: { originalQuery: context?.query }
    };
  }

  if (error?.message?.includes('database') || error?.code === 'DATABASE_ERROR') {
    return {
      type: 'database_connection_error',
      severity: 'medium',
      recoverable: true,
      fallbackStrategy: 'offline_knowledge_fallback',
      message: 'Database unavailable, using LLM knowledge',
      context: { operation: context?.operation }
    };
  }

  if (
    error?.message?.includes('validation failed') ||
    error?.message?.includes('Required section missing')
  ) {
    return {
      type: 'format_validation_failed',
      severity: 'low',
      recoverable: true,
      fallbackStrategy: 'format_recovery',
      message: 'Response format validation failed, attempting recovery',
      context: { validationErrors: error?.validationErrors }
    };
  }

  return {
    type: 'unknown_error',
    severity: 'medium',
    recoverable: true,
    fallbackStrategy: 'graceful_degradation',
    message: error?.message || 'An unexpected error occurred',
    context: { originalError: error }
  };
}

/**
 * Create error response with proper markdown structure
 * Ensures error responses still meet format compliance requirements
 */
export function createErrorResponse(
  classification: ErrorClassification,
  intent: QueryIntent = 'general_switch_info',
  query?: string
): AnalysisResponse {
  const baseResponse: AnalysisResponse = {
    overview: generateErrorOverview(classification, query),
    analysis: generateErrorAnalysis(classification, intent),
    additionalNotes: `Error handled gracefully - Type: ${classification.type}, Severity: ${classification.severity}, Recoverable: ${classification.recoverable}`,
    dataSource: 'Error Handler',
    analysisConfidence: 'Low'
  };

  switch (intent) {
    case 'switch_comparison':
      return {
        ...baseResponse,
        conclusion: generateComparisonErrorConclusion(classification),
        comparativeAnalysis: {
          feelingTactility: 'Comparison unavailable due to system error. Please try again shortly.'
        }
      };

    case 'material_analysis':
      return {
        ...baseResponse,
        materialAnalysis: {
          materialComposition:
            'Material analysis temporarily unavailable due to system limitations.'
        }
      };

    default:
      return baseResponse;
  }
}

/**
 * Generate appropriate error overview based on classification
 */
function generateErrorOverview(classification: ErrorClassification, query?: string): string {
  const queryContext = query ? ` regarding "${query}"` : '';

  switch (classification.type) {
    case 'api_quota_exceeded':
      return `I apologize, but I'm currently experiencing high demand and have temporarily reached my processing capacity${queryContext}. I can still provide helpful information using my built-in knowledge base, though with limited real-time updates.`;

    case 'api_service_unavailable':
      return `I'm experiencing temporary technical difficulties${queryContext}. The system is working to restore full functionality. In the meantime, I can provide basic assistance using available resources.`;

    case 'intent_recognition_failed':
      return `I'm having difficulty understanding the specific nature of your request${queryContext}. I'll do my best to provide helpful general information about mechanical keyboard switches.`;

    case 'database_connection_error':
      return `I'm currently unable to access the latest switch database${queryContext}. I can still provide general guidance based on established knowledge about mechanical keyboard switches.`;

    case 'format_validation_failed':
      return `I was able to generate a response${queryContext}, but encountered some formatting issues. The content should still be helpful despite minor presentation problems.`;

    default:
      return `I encountered an unexpected issue while processing your request${queryContext}. I'll provide the best information I can with current system capabilities.`;
  }
}

/**
 * Generate error analysis with proper markdown structure
 */
function generateErrorAnalysis(classification: ErrorClassification, intent: QueryIntent): string {
  const baseAnalysis = `## Overview\n\n${generateErrorOverview(classification)}\n\n## System Status\n\n`;

  let statusContent = '';
  switch (classification.severity) {
    case 'low':
      statusContent = 'Minor service interruption. Most functionality remains available.';
      break;
    case 'medium':
      statusContent =
        'Partial service interruption. Core functionality available with limitations.';
      break;
    case 'high':
      statusContent = 'Significant service interruption. Operating in fallback mode.';
      break;
    case 'critical':
      statusContent = 'Major service interruption. Limited functionality available.';
      break;
  }

  let recoveryInfo = '';
  if (classification.recoverable) {
    recoveryInfo =
      '\n\n## Expected Resolution\n\nThis issue is typically temporary. Please try again in a few minutes for full functionality.';
  }

  let intentSpecificContent = '';
  switch (intent) {
    case 'switch_comparison':
      intentSpecificContent =
        '\n\n## Comparison Notes\n\nWhile I cannot provide detailed comparisons at this time, I recommend checking manufacturer specifications for technical details.';
      break;
    case 'material_analysis':
      intentSpecificContent =
        '\n\n## Material Analysis Notes\n\nFor detailed material analysis, consider consulting technical documentation or manufacturer resources.';
      break;
    default:
      intentSpecificContent =
        '\n\n## General Information\n\nI can still provide basic guidance about mechanical keyboard switches using established knowledge.';
  }

  return baseAnalysis + statusContent + recoveryInfo + intentSpecificContent;
}

/**
 * Generate comparison-specific error conclusion
 */
function generateComparisonErrorConclusion(classification: ErrorClassification): string {
  return `Due to ${classification.message.toLowerCase()}, I cannot provide a detailed comparison at this time. For accurate comparisons, I recommend consulting manufacturer specifications or trying again when full system functionality is restored.`;
}

/**
 * Extract retry delay from Gemini API error messages
 */
function extractRetryDelay(errorMessage: string): number {
  const retryMatch = errorMessage.match(/retryDelay":"(\d+)s/);
  return retryMatch ? parseInt(retryMatch[1]) * 1000 : 60000;
}

/**
 * Determine if error is recoverable with retry
 */
export function isRetryableError(classification: ErrorClassification): boolean {
  return (
    classification.recoverable &&
    ['api_service_unavailable', 'database_connection_error'].includes(classification.type)
  );
}

/**
 * Get appropriate delay for retry based on error type
 */
export function getRetryDelay(classification: ErrorClassification): number {
  switch (classification.type) {
    case 'api_quota_exceeded':
      return classification.context?.retryAfter || 60000;
    case 'api_service_unavailable':
      return classification.context?.backoffMs || 5000;
    case 'database_connection_error':
      return 2000;
    default:
      return 1000;
  }
}

/**
 * Log error with appropriate detail level
 */
export function logError(classification: ErrorClassification, context?: any): void {
  const logLevel =
    classification.severity === 'critical'
      ? 'error'
      : classification.severity === 'high'
        ? 'warn'
        : 'info';

  const logData = {
    type: classification.type,
    severity: classification.severity,
    message: classification.message,
    recoverable: classification.recoverable,
    strategy: classification.fallbackStrategy,
    context: classification.context,
    additionalContext: context
  };

  console[logLevel](`[ErrorHandler] ${classification.type}:`, logData);
}

/**
 * Utility for creating fallback responses that maintain quality thresholds
 */
export function createQualityFallbackResponse(
  query: string,
  intent: QueryIntent = 'general_switch_info'
): AnalysisResponse {
  return {
    overview: `While I'm experiencing some technical limitations, I can still provide helpful guidance about your query: "${query}". This response uses built-in knowledge to ensure you receive useful information.`,
    analysis: `## Overview\n\nWhile I'm experiencing some technical limitations, I can still provide helpful guidance about your query: "${query}". This response uses built-in knowledge to ensure you receive useful information.\n\n## General Information\n\nMechanical keyboard switches come in three main types: Linear (smooth keypress), Tactile (bump feedback), and Clicky (audible click). Popular brands include Cherry MX, Gateron, Kailh, and others. Key factors to consider include actuation force, travel distance, sound profile, and intended use case.\n\n## Recommendations\n\n- For gaming: Linear switches with low actuation force (45-50g)\n- For typing: Tactile switches with moderate actuation force (50-65g)\n- For quiet environments: Linear switches or tactile switches with dampening\n- For feedback preference: Clicky switches with pronounced tactile and audible feedback`,
    additionalNotes:
      'Response generated using offline knowledge base due to technical limitations. For detailed specifications, please try again when full system functionality is restored.',
    dataSource: 'Offline Knowledge Base',
    analysisConfidence: 'Medium'
  };
}

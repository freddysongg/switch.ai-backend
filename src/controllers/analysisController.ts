/**
 * Analysis Controller for LLM-Powered Switch Analysis
 *
 * This controller handles incoming analysis requests, orchestrates calls to services,
 * and returns structured JSON responses for the switch analysis feature.
 */

import { Request, Response } from 'express';

import { LLMAnalysisService } from '../services/llmAnalysisService.js';
import type {
  AnalysisError,
  AnalysisRequest,
  AnalysisRequestBody
} from '../types/analysisTypes.js';
import { LoggingHelper } from '../utils/loggingHelper.js';

const llmAnalysisService = new LLMAnalysisService();

export class AnalysisController {
  /**
   * Main endpoint for processing switch analysis queries (FR1.1, FR3.1)
   * POST /api/analysis/query
   */
  async processQuery(req: Request, res: Response): Promise<void> {
    const requestId = LoggingHelper.generateRequestId();

    try {
      const requestBody = req.body as AnalysisRequestBody;
      const userId = req.user?.id;

      // Authentication validation
      if (!userId) {
        LoggingHelper.logError(requestId, 'Unauthorized access attempt', 'authentication');
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Enhanced input validation (FR1.1)
      const validationResult = this.validateRequestBody(requestBody);
      if (!validationResult.isValid) {
        LoggingHelper.logError(
          requestId,
          'Invalid request body',
          'input_validation',
          validationResult.errors
        );
        res.status(400).json({
          error: 'Invalid request format.',
          details: validationResult.errors
        });
        return;
      }

      // Create comprehensive AnalysisRequest object
      const analysisRequest: AnalysisRequest = {
        // Core query fields
        query: requestBody.query.trim(),
        conversationId: requestBody.conversationId,
        userId,

        // Follow-up context
        followUpContext: requestBody.followUpContext,

        // User preferences with defaults
        preferences: {
          detailLevel: requestBody.preferences?.detailLevel || 'moderate',
          technicalDepth: requestBody.preferences?.technicalDepth || 'intermediate',
          includeRecommendations: requestBody.preferences?.includeRecommendations ?? true,
          maxSwitchesInComparison: Math.min(
            requestBody.preferences?.maxSwitchesInComparison || 3,
            5
          ),
          preferredResponseSections: requestBody.preferences?.preferredResponseSections || []
        },

        // Request metadata
        requestId,
        timestamp: new Date(),
        source: (requestBody.source as 'web' | 'api' | 'mobile') || 'api',

        // Query hints
        queryHints: requestBody.queryHints,

        // Additional metadata
        metadata: {
          ...requestBody.metadata,
          userAgent: req.headers['user-agent'],
          clientIP: req.ip
        }
      };

      LoggingHelper.logRequestReceived(analysisRequest, requestId);

      // Main processing workflow - returns AnalysisResponse directly
      const analysisResponse = await llmAnalysisService.processAnalysisRequest(analysisRequest);

      // Check if response contains an error
      if (analysisResponse.error) {
        this.handleAnalysisError(res, analysisResponse.error, requestId);
        return;
      }

      // Successful response
      res.json({
        ...analysisResponse,
        requestId,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      LoggingHelper.logError(requestId, error, 'critical_controller_error');

      // Check if headers have already been sent before trying to send another response
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error during analysis processing.',
          requestId,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Validate the request body structure and content (FR1.1)
   * @param requestBody The request body to validate
   * @returns Validation result with errors if any
   */
  private validateRequestBody(requestBody: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required field validation
    if (
      !requestBody.query ||
      typeof requestBody.query !== 'string' ||
      requestBody.query.trim() === ''
    ) {
      errors.push('Query is required and must be a non-empty string.');
    }

    // Query length validation
    if (requestBody.query && requestBody.query.length > 2000) {
      errors.push('Query is too long. Maximum length is 2000 characters.');
    }

    // Conversation ID validation
    if (requestBody.conversationId && typeof requestBody.conversationId !== 'string') {
      errors.push('Conversation ID must be a string.');
    }

    // Preferences validation
    if (requestBody.preferences) {
      const prefs = requestBody.preferences;

      if (prefs.detailLevel && !['brief', 'moderate', 'detailed'].includes(prefs.detailLevel)) {
        errors.push('Detail level must be one of: brief, moderate, detailed.');
      }

      if (
        prefs.technicalDepth &&
        !['basic', 'intermediate', 'advanced'].includes(prefs.technicalDepth)
      ) {
        errors.push('Technical depth must be one of: basic, intermediate, advanced.');
      }

      if (
        prefs.maxSwitchesInComparison &&
        (typeof prefs.maxSwitchesInComparison !== 'number' ||
          prefs.maxSwitchesInComparison < 1 ||
          prefs.maxSwitchesInComparison > 10)
      ) {
        errors.push('Max switches in comparison must be a number between 1 and 10.');
      }

      if (prefs.preferredResponseSections && !Array.isArray(prefs.preferredResponseSections)) {
        errors.push('Preferred response sections must be an array.');
      }
    }

    // Follow-up context validation
    if (requestBody.followUpContext) {
      const context = requestBody.followUpContext;

      if (context.conversationHistory && !Array.isArray(context.conversationHistory)) {
        errors.push('Conversation history must be an array.');
      }

      if (context.conversationHistory && context.conversationHistory.length > 20) {
        errors.push('Conversation history is too long. Maximum 20 entries.');
      }
    }

    // Query hints validation
    if (requestBody.queryHints) {
      const hints = requestBody.queryHints;

      if (hints.switchNames && !Array.isArray(hints.switchNames)) {
        errors.push('Switch names hint must be an array.');
      }

      if (hints.materials && !Array.isArray(hints.materials)) {
        errors.push('Materials hint must be an array.');
      }

      if (hints.comparisonType && !['detailed', 'quick'].includes(hints.comparisonType)) {
        errors.push('Comparison type must be either detailed or quick.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Endpoint for recognizing query intent (FR1.2)
   * POST /api/analysis/intent
   */
  async recognizeIntent(req: Request, res: Response): Promise<void> {
    const requestId = LoggingHelper.generateRequestId();

    try {
      const { query } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        const authError: AnalysisError = {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required to access the analysis service.',
          recoverable: false,
          timestamp: new Date()
        };
        this.handleAnalysisError(res, authError, requestId);
        return;
      }

      if (!query || typeof query !== 'string' || query.trim() === '') {
        const invalidQueryError: AnalysisError = {
          code: 'INVALID_QUERY',
          message: 'Query is required and must be a non-empty string.',
          recoverable: true,
          step: 'input_validation',
          timestamp: new Date(),
          details: {
            field: 'query',
            expectedType: 'non-empty string',
            receivedType: typeof query,
            guidance: 'Provide a clear question about keyboard switches'
          }
        };
        this.handleAnalysisError(res, invalidQueryError, requestId);
        return;
      }

      if (query.length > 2000) {
        const lengthError: AnalysisError = {
          code: 'INVALID_QUERY',
          message: 'Query is too long. Please limit your question to 2000 characters or less.',
          recoverable: true,
          step: 'input_validation',
          timestamp: new Date(),
          details: {
            currentLength: query.length,
            maxLength: 2000,
            guidance: 'Break down complex questions into simpler parts'
          }
        };
        this.handleAnalysisError(res, lengthError, requestId);
        return;
      }

      // Attempt intent recognition with enhanced error handling
      let intentResult;
      try {
        intentResult = await llmAnalysisService.recognizeIntent(query.trim(), requestId);
      } catch (intentError: any) {
        let analysisError: AnalysisError;

        if (intentError.message.includes('timeout')) {
          analysisError = {
            code: 'TIMEOUT',
            message: 'Intent recognition took too long to complete. Please try with a simpler query.',
            recoverable: true,
            step: 'intent_recognition',
            timestamp: new Date(),
            retryDelay: 3000
          };
        } else if (intentError.message.includes('rate limit')) {
          analysisError = {
            code: 'RATE_LIMITED',
            message: 'Too many intent recognition requests. Please wait before trying again.',
            recoverable: true,
            step: 'intent_recognition',
            timestamp: new Date(),
            retryDelay: 30000
          };
        } else {
          analysisError = {
            code: 'INTENT_RECOGNITION_FAILED',
            message: 'Unable to understand your query. Please try rephrasing with specific switch names or clearer language.',
            recoverable: true,
            step: 'intent_recognition',
            timestamp: new Date(),
            retryDelay: 1000,
            details: {
              originalError: intentError.message,
              suggestions: [
                'Include specific switch names (e.g., "Cherry MX Red")',
                'Ask about specific characteristics (sound, feel, force)',
                'Use simpler, more direct language'
              ]
            }
          };
        }

        this.handleAnalysisError(res, analysisError, requestId);
        return;
      }

      // Validate intent result quality
      if (!intentResult || !intentResult.intent || intentResult.confidence < 0.3) {
        const lowConfidenceError: AnalysisError = {
          code: 'INTENT_RECOGNITION_FAILED',
          message: 'I had difficulty understanding your query. Please try being more specific about what you want to know.',
          recoverable: true,
          step: 'intent_validation',
          timestamp: new Date(),
          details: {
            confidence: intentResult?.confidence || 0,
            recognizedIntent: intentResult?.intent || 'unknown',
            guidance: 'Use more specific switch names or ask about particular characteristics'
          }
        };
        this.handleAnalysisError(res, lowConfidenceError, requestId);
        return;
      }

      res.json({
        requestId,
        intent: intentResult,
        timestamp: new Date().toISOString(),
        confidence: intentResult.confidence,
        processingQuality: intentResult.confidence >= 0.8 ? 'high' : intentResult.confidence >= 0.6 ? 'medium' : 'low'
      });
    } catch (error: any) {
      LoggingHelper.logError(requestId, error, 'intent_recognition_critical_error');

      const criticalError: AnalysisError = {
        code: 'INTERNAL_ERROR',
        message: 'A critical error occurred during intent recognition. Please try again or contact support.',
        recoverable: true,
        step: 'intent_recognition_critical',
        timestamp: new Date(),
        retryDelay: 5000,
        details: {
          errorType: error.name || 'Unknown',
          guidance: 'If this error persists, please contact technical support'
        }
      };

      this.handleAnalysisError(res, criticalError, requestId);
    }
  }

  /**
   * Health check endpoint for the analysis service
   * GET /api/analysis/health
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement health check logic
      // - Check LLM service availability
      // - Check database connectivity
      // - Verify service dependencies

      res.json({
        status: 'healthy',
        service: 'analysis',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      });
    } catch (error: any) {
      console.error('Analysis health check error:', error);

      if (!res.headersSent) {
        res.status(500).json({
          status: 'unhealthy',
          service: 'analysis',
          error: 'Service health check failed',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Get analysis service configuration and capabilities
   * GET /api/analysis/config
   */
  async getServiceConfig(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // TODO: Implement configuration endpoint
      // - Return supported query types
      // - Return response structure information
      // - Return service capabilities

      res.json({
        supportedIntents: [
          'general_switch_info',
          'switch_comparison',
          'material_analysis',
          'follow_up_question'
        ],
        responseStructure: {
          mandatoryFields: ['overview'],
          optionalSections: [
            'switchSpecifications',
            'comparisonAnalysis',
            'materialAnalysis',
            'exampleSwitches',
            'recommendations'
          ]
        },
        capabilities: {
          maxSwitchesInComparison: 5,
          supportedMaterials: ['housing', 'stem', 'spring'],
          followUpContextLength: 10
        },
        version: '1.0.0',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Get service config error:', error);

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error while retrieving service configuration.',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Handle analysis errors and return appropriate responses (FR6.1, FR6.2)
   * @param res Express response object
   * @param error Analysis error object
   * @param requestId Request identifier for logging
   */
  private handleAnalysisError(res: Response, error: AnalysisError, requestId: string): void {
    LoggingHelper.logError(requestId, error, 'analysis_error_handling');

    // Determine appropriate status code based on error code
    let statusCode = 500;
    let userMessage = error.message; // Use the user-friendly message from the error
    let additionalContext: any = {};

    switch (error.code) {
      case 'INVALID_QUERY':
        statusCode = 400;
        additionalContext.suggestions = [
          'Ensure your query contains a clear question about switches',
          'Include specific switch names for better results',
          'Check query length (max 2000 characters)'
        ];
        break;
      case 'INTENT_RECOGNITION_FAILED':
        statusCode = 422;
        additionalContext.examples = [
          'What are the differences between Cherry MX Red and Blue?',
          'Tell me about Gateron Yellow switches',
          'Compare linear vs tactile switches'
        ];
        break;
      case 'DATABASE_ERROR':
        statusCode = 503;
        additionalContext.fallbackAvailable = true;
        additionalContext.notice = 'Analysis will continue using general knowledge';
        break;
      case 'LLM_REQUEST_FAILED':
      case 'LLM_RESPONSE_INVALID':
        statusCode = 503;
        additionalContext.serviceStatus = 'temporarily_unavailable';
        break;
      case 'RESPONSE_VALIDATION_FAILED':
        statusCode = 500;
        additionalContext.userAction = 'Please try rephrasing your query or ask about a different topic';
        break;
      case 'TIMEOUT':
        statusCode = 504;
        additionalContext.suggestions = [
          'Try asking about fewer switches at once',
          'Simplify your query',
          'Retry in a few moments'
        ];
        break;
      case 'RATE_LIMITED':
        statusCode = 429;
        if (error.retryDelay) {
          const retryAfterSeconds = Math.ceil(error.retryDelay / 1000);
          res.set('Retry-After', retryAfterSeconds.toString());
          additionalContext.retryAfter = retryAfterSeconds;
        }
        break;
      case 'NETWORK_ERROR':
        statusCode = 503;
        additionalContext.networkIssue = true;
        break;
      case 'AUTHENTICATION_ERROR':
        statusCode = 401;
        additionalContext.requiresReauth = true;
        break;
      case 'QUOTA_EXCEEDED':
        statusCode = 429;
        if (error.retryDelay) {
          const retryAfterSeconds = Math.ceil(error.retryDelay / 1000);
          res.set('Retry-After', retryAfterSeconds.toString());
          additionalContext.quotaReset = new Date(Date.now() + error.retryDelay).toISOString();
        }
        break;
      default:
        statusCode = 500;
        additionalContext.supportContact = 'Please contact support if this error persists';
    }

    // Enhanced error response structure
    const errorResponse: any = {
      error: userMessage,
      errorCode: error.code,
      requestId,
      timestamp: new Date().toISOString(),
      retryable: error.recoverable || false
    };

    // Add step-specific context if available
    if (error.step) {
      errorResponse.failedAt = error.step;
    }

    // Add additional context without sensitive information
    if (Object.keys(additionalContext).length > 0) {
      errorResponse.context = additionalContext;
    }

    // Add guidance if available in error details
    if (error.details?.guidance) {
      errorResponse.guidance = error.details.guidance;
    }

    // Add user suggestions if available
    if (error.details?.suggestions) {
      errorResponse.suggestions = error.details.suggestions;
    }

    // Add retry information for recoverable errors
    if (error.recoverable && error.retryDelay) {
      errorResponse.retryAfter = Math.ceil(error.retryDelay / 1000);
    }

    // Development mode: add more technical details
    if (process.env.NODE_ENV === 'development' && error.details) {
      errorResponse.debugInfo = {
        errorType: error.details.errorType,
        step: error.details.step,
        ...(error.details.stackTrace && { stackTrace: error.details.stackTrace })
      };
    }

    // Return structured error response
    if (!res.headersSent) {
      res.status(statusCode).json(errorResponse);
    }
  }
}

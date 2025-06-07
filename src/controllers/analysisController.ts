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
   * Main endpoint for processing switch analysis queries
   * Handles request validation, orchestrates service calls, and returns structured responses
   * Supports various query types including single switch analysis, comparisons, and follow-ups
   *
   * @param req - Express request object containing the analysis request body
   * @param res - Express response object for sending the analysis response
   * @returns Promise<void>
   */
  async processQuery(req: Request, res: Response): Promise<void> {
    const requestId = LoggingHelper.generateRequestId();

    try {
      const requestBody = req.body as AnalysisRequestBody;
      const userId = req.user?.id;

      if (!userId) {
        LoggingHelper.logError(requestId, 'Unauthorized access attempt', 'authentication');
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

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

      const analysisRequest: AnalysisRequest = {
        query: requestBody.query.trim(),
        conversationId: requestBody.conversationId,
        userId,

        followUpContext: requestBody.followUpContext,

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

        requestId,
        timestamp: new Date(),
        source: (requestBody.source as 'web' | 'api' | 'mobile') || 'api',

        queryHints: requestBody.queryHints,

        metadata: {
          ...requestBody.metadata,
          userAgent: req.headers['user-agent'],
          clientIP: req.ip
        }
      };

      LoggingHelper.logRequestReceived(analysisRequest, requestId);

      const analysisResponse = await llmAnalysisService.processAnalysisRequest(analysisRequest);

      if (analysisResponse.error) {
        this.handleAnalysisError(res, analysisResponse.error, requestId);
        return;
      }

      res.json({
        ...analysisResponse,
        requestId,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      LoggingHelper.logError(requestId, error, 'critical_controller_error');

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
   * Validates the request body structure and content for analysis requests
   * Checks for required fields, proper types, and business rule constraints
   *
   * @param requestBody - The request body object to validate
   * @returns Object containing validation result and any error messages
   */
  private validateRequestBody(requestBody: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (
      !requestBody.query ||
      typeof requestBody.query !== 'string' ||
      requestBody.query.trim() === ''
    ) {
      errors.push('Query is required and must be a non-empty string.');
    }

    if (requestBody.query && requestBody.query.length > 2000) {
      errors.push('Query is too long. Maximum length is 2000 characters.');
    }

    if (requestBody.conversationId && typeof requestBody.conversationId !== 'string') {
      errors.push('Conversation ID must be a string.');
    }

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

    if (requestBody.followUpContext) {
      const context = requestBody.followUpContext;

      if (context.conversationHistory && !Array.isArray(context.conversationHistory)) {
        errors.push('Conversation history must be an array.');
      }

      if (context.conversationHistory && context.conversationHistory.length > 20) {
        errors.push('Conversation history is too long. Maximum 20 entries.');
      }
    }

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
   * Endpoint for recognizing query intent without performing full analysis
   * Useful for debugging, testing, and providing query suggestions to users
   * Returns intent classification and confidence scores
   *
   * @param req - Express request object containing the query to analyze
   * @param res - Express response object for sending the intent recognition result
   * @returns Promise<void>
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

      let intentResult;
      try {
        intentResult = await llmAnalysisService.recognizeIntent(query.trim(), requestId);
      } catch (intentError: any) {
        let analysisError: AnalysisError;

        if (intentError.message.includes('timeout')) {
          analysisError = {
            code: 'TIMEOUT',
            message:
              'Intent recognition took too long to complete. Please try with a simpler query.',
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
            message:
              'Unable to understand your query. Please try rephrasing with specific switch names or clearer language.',
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

      if (!intentResult || !intentResult.intent || intentResult.confidence < 0.3) {
        const lowConfidenceError: AnalysisError = {
          code: 'INTENT_RECOGNITION_FAILED',
          message:
            'I had difficulty understanding your query. Please try being more specific about what you want to know.',
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
        processingQuality:
          intentResult.confidence >= 0.8
            ? 'high'
            : intentResult.confidence >= 0.6
              ? 'medium'
              : 'low'
      });
    } catch (error: any) {
      LoggingHelper.logError(requestId, error, 'intent_recognition_critical_error');

      const criticalError: AnalysisError = {
        code: 'INTERNAL_ERROR',
        message:
          'A critical error occurred during intent recognition. Please try again or contact support.',
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
   * Verifies service availability and dependency status
   * Used by load balancers and monitoring systems
   *
   * @param req - Express request object
   * @param res - Express response object for sending health status
   * @returns Promise<void>
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
   * Returns supported features, limits, and service metadata
   * Useful for client applications and API documentation
   *
   * @param req - Express request object
   * @param res - Express response object for sending configuration data
   * @returns Promise<void>
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
   * Handles analysis errors and returns appropriate HTTP responses
   * Maps error codes to status codes and provides user-friendly messages
   * Includes retry information and debugging context when appropriate
   *
   * @param res - Express response object for sending error response
   * @param error - Analysis error object containing error details
   * @param requestId - Request identifier for logging and tracking
   * @returns void
   */
  private handleAnalysisError(res: Response, error: AnalysisError, requestId: string): void {
    LoggingHelper.logError(requestId, error, 'analysis_error_handling');

    let statusCode = 500;
    const userMessage = error.message;
    const additionalContext: any = {};

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
        additionalContext.userAction =
          'Please try rephrasing your query or ask about a different topic';
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

    const errorResponse: any = {
      error: userMessage,
      errorCode: error.code,
      requestId,
      timestamp: new Date().toISOString(),
      retryable: error.recoverable || false
    };

    if (error.step) {
      errorResponse.failedAt = error.step;
    }

    if (Object.keys(additionalContext).length > 0) {
      errorResponse.context = additionalContext;
    }

    if (error.details?.guidance) {
      errorResponse.guidance = error.details.guidance;
    }

    if (error.details?.suggestions) {
      errorResponse.suggestions = error.details.suggestions;
    }

    if (error.recoverable && error.retryDelay) {
      errorResponse.retryAfter = Math.ceil(error.retryDelay / 1000);
    }

    if (process.env.NODE_ENV === 'development' && error.details) {
      errorResponse.debugInfo = {
        errorType: error.details.errorType,
        step: error.details.step,
        ...(error.details.stackTrace && { stackTrace: error.details.stackTrace })
      };
    }

    if (!res.headersSent) {
      res.status(statusCode).json(errorResponse);
    }
  }
}

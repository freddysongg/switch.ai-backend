/**
 * Analysis Routes for LLM-Powered Switch Analysis
 *
 * This file defines the API endpoints for the switch analysis feature,
 * including query processing, intent recognition, and service health checks.
 *
 * Base URL: /api/analysis
 *
 * Endpoints:
 * - POST /query - Main analysis endpoint for user queries
 * - POST /intent - Intent recognition only (for debugging/testing)
 * - GET /health - Service health check
 * - GET /config - Service configuration details
 * - GET /test - Test endpoint for development
 */

import { NextFunction, Request, Response, Router } from 'express';

import { AnalysisController } from '../controllers/analysisController.js';
import { AnalysisRequestBody } from '../types/analysisTypes.js';

const router = Router();
const analysisController = new AnalysisController();

/**
 * Request validation middleware for analysis queries
 */
const validateAnalysisRequest = (req: Request, res: Response, next: NextFunction): void => {
  const body = req.body as AnalysisRequestBody;

  // Check required fields
  if (!body.query || typeof body.query !== 'string') {
    res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Query field is required and must be a string',
        details: { field: 'query', type: 'string', required: true }
      }
    });
    return;
  }

  // Validate query length
  if (body.query.trim().length === 0) {
    res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Query cannot be empty',
        details: { field: 'query', issue: 'empty_string' }
      }
    });
    return;
  }

  if (body.query.length > 2000) {
    res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Query too long (maximum 2000 characters)',
        details: { field: 'query', maxLength: 2000, currentLength: body.query.length }
      }
    });
    return;
  }

  // Validate optional fields
  if (body.conversationId && typeof body.conversationId !== 'string') {
    res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'ConversationId must be a string',
        details: { field: 'conversationId', type: 'string' }
      }
    });
    return;
  }

  if (body.preferences) {
    const validDetailLevels = ['brief', 'moderate', 'detailed'];
    const validTechnicalDepths = ['basic', 'intermediate', 'advanced'];

    if (body.preferences.detailLevel && !validDetailLevels.includes(body.preferences.detailLevel)) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid detail level',
          details: { field: 'preferences.detailLevel', validValues: validDetailLevels }
        }
      });
      return;
    }

    if (
      body.preferences.technicalDepth &&
      !validTechnicalDepths.includes(body.preferences.technicalDepth)
    ) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid technical depth',
          details: { field: 'preferences.technicalDepth', validValues: validTechnicalDepths }
        }
      });
      return;
    }

    if (
      body.preferences.maxSwitchesInComparison &&
      (body.preferences.maxSwitchesInComparison < 2 ||
        body.preferences.maxSwitchesInComparison > 10)
    ) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'maxSwitchesInComparison must be between 2 and 10',
          details: { field: 'preferences.maxSwitchesInComparison', min: 2, max: 10 }
        }
      });
      return;
    }
  }

  next();
};

/**
 * Intent recognition validation middleware
 */
const validateIntentRequest = (req: Request, res: Response, next: NextFunction): void => {
  const { query } = req.body;

  if (!query || typeof query !== 'string') {
    res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Query field is required and must be a string',
        details: { field: 'query', type: 'string', required: true }
      }
    });
    return;
  }

  if (query.trim().length === 0) {
    res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Query cannot be empty',
        details: { field: 'query', issue: 'empty_string' }
      }
    });
    return;
  }

  next();
};

// ============================================================================
// MAIN ANALYSIS ENDPOINTS
// ============================================================================

/**
 * POST /api/analysis/query
 *
 * Main analysis endpoint for processing user queries about mechanical keyboard switches.
 * Supports single switch analysis, comparisons, material analysis, and follow-up questions.
 *
 * Request Body:
 * {
 *   "query": "string (required) - User's natural language query",
 *   "conversationId": "string (optional) - ID for conversation continuity",
 *   "preferences": {
 *     "detailLevel": "brief|moderate|detailed (optional)",
 *     "technicalDepth": "basic|intermediate|advanced (optional)",
 *     "includeRecommendations": "boolean (optional)",
 *     "maxSwitchesInComparison": "number 2-10 (optional)",
 *     "preferredResponseSections": "string[] (optional)",
 *     "focusAreas": "string[] (optional)"
 *   },
 *   "followUpContext": {
 *     "previousQuery": "string (optional)",
 *     "previousResponse": "object (optional)",
 *     "conversationHistory": "array (optional)"
 *   },
 *   "queryHints": {
 *     "expectedIntent": "string (optional)",
 *     "switchNames": "string[] (optional)",
 *     "materials": "string[] (optional)",
 *     "comparisonType": "detailed|quick (optional)"
 *   },
 *   "source": "string (optional) - Request source identifier",
 *   "metadata": "object (optional) - Additional request metadata"
 * }
 *
 * Response: AnalysisResponse JSON with structured switch analysis
 */
router.post(
  '/query',
  validateAnalysisRequest,
  analysisController.processQuery.bind(analysisController)
);

/**
 * POST /api/analysis/intent
 *
 * Intent recognition endpoint for testing and debugging query interpretation.
 * Returns only the intent recognition result without full analysis.
 *
 * Request Body:
 * {
 *   "query": "string (required) - User's natural language query"
 * }
 *
 * Response: IntentRecognitionResult JSON with intent and extracted entities
 */
router.post(
  '/intent',
  validateIntentRequest,
  analysisController.recognizeIntent.bind(analysisController)
);

// ============================================================================
// SERVICE MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/analysis/health
 *
 * Service health check endpoint for monitoring service availability.
 * Returns system status, database connectivity, and LLM service status.
 *
 * Response:
 * {
 *   "status": "healthy|degraded|unhealthy",
 *   "timestamp": "ISO timestamp",
 *   "services": {
 *     "database": "healthy|error",
 *     "llm": "healthy|error",
 *     "promptHelper": "healthy|error"
 *   },
 *   "version": "string",
 *   "uptime": "number (seconds)"
 * }
 */
router.get('/health', analysisController.healthCheck.bind(analysisController));

/**
 * GET /api/analysis/config
 *
 * Service configuration endpoint for debugging and monitoring.
 * Returns current service configuration and capabilities.
 *
 * Response:
 * {
 *   "version": "string",
 *   "features": {
 *     "singleSwitchAnalysis": "boolean",
 *     "switchComparison": "boolean",
 *     "materialAnalysis": "boolean",
 *     "followUpQueries": "boolean"
 *   },
 *   "limits": {
 *     "maxQueryLength": "number",
 *     "maxSwitchesInComparison": "number",
 *     "maxConversationHistory": "number"
 *   },
 *   "llmConfig": {
 *     "model": "string",
 *     "maxTokens": "number",
 *     "temperature": "number"
 *   }
 * }
 */
router.get('/config', analysisController.getServiceConfig.bind(analysisController));

/**
 * GET /api/analysis/test
 *
 * Test endpoint for development and debugging.
 * Returns basic service information and sample query examples.
 *
 * Response:
 * {
 *   "message": "Switch Analysis Service Test Endpoint",
 *   "timestamp": "ISO timestamp",
 *   "sampleQueries": "string[]",
 *   "supportedIntents": "string[]"
 * }
 */
router.get('/test', (req: Request, res: Response) => {
  res.json({
    message: 'Switch Analysis Service Test Endpoint',
    timestamp: new Date().toISOString(),
    sampleQueries: [
      'What are Cherry MX Blue switches like?',
      'Compare Gateron Yellow vs Cherry MX Red',
      'How does POM housing affect switch sound?',
      'Which switches are best for gaming?'
    ],
    supportedIntents: [
      'general_switch_info',
      'switch_comparison',
      'material_analysis',
      'follow_up_question'
    ],
    endpoints: {
      main: 'POST /api/analysis/query',
      intent: 'POST /api/analysis/intent',
      health: 'GET /api/analysis/health',
      config: 'GET /api/analysis/config'
    }
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Global error handler for analysis routes
 */
router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[AnalysisRoutes] Unhandled error:', error);

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred while processing your request',
      details: {
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method
      }
    }
  });
});

export default router;

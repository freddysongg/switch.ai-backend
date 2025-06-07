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

import express, { NextFunction, Request, Response } from 'express';

import { AnalysisController } from '../controllers/analysisController.js';
import { analysisRequestSchema, intentRequestSchema, validateBody } from '../schemas/validation.js';

const router = express.Router();
const analysisController = new AnalysisController();

/**
 * POST /api/analysis/query
 * Main analysis endpoint for processing user queries about mechanical keyboard switches
 * Supports single switch analysis, comparisons, material analysis, and follow-up questions
 * Validates request body using analysisRequestSchema and returns structured AnalysisResponse
 *
 * @route POST /api/analysis/query
 * @access Private (requires authentication)
 * @param {AnalysisRequestBody} req.body - Analysis request with query and preferences
 * @returns {AnalysisResponse} Structured switch analysis with overview and relevant sections
 */
router.post(
  '/query',
  validateBody(analysisRequestSchema),
  analysisController.processQuery.bind(analysisController)
);

/**
 * POST /api/analysis/intent
 * Intent recognition endpoint for testing and debugging query interpretation
 * Returns only the intent recognition result without performing full analysis
 * Useful for understanding how queries are classified and building better UX
 *
 * @route POST /api/analysis/intent
 * @access Private (requires authentication)
 * @param {IntentRequestBody} req.body - Simple request with query string
 * @returns {IntentRecognitionResult} Intent classification with confidence scores
 */
router.post(
  '/intent',
  validateBody(intentRequestSchema),
  analysisController.recognizeIntent.bind(analysisController)
);

/**
 * GET /api/analysis/health
 * Health check endpoint for the analysis service
 * Returns service status, dependencies, and performance metrics
 * Used by load balancers and monitoring systems to verify service availability
 *
 * @route GET /api/analysis/health
 * @access Public
 * @returns {HealthCheckResponse} Service health status and metadata
 */
router.get('/health', analysisController.healthCheck.bind(analysisController));

/**
 * GET /api/analysis/config
 * Service configuration endpoint for debugging and client integration
 * Returns current service configuration, capabilities, and feature flags
 * Helps client applications understand available features and limits
 *
 * @route GET /api/analysis/config
 * @access Private (requires authentication)
 * @returns {ServiceConfigResponse} Service configuration and capabilities
 */
router.get('/config', analysisController.getServiceConfig.bind(analysisController));

/**
 * GET /api/analysis/test
 * Test endpoint for development and debugging
 * Returns basic service information, sample queries, and endpoint documentation
 * Useful for verifying service deployment and exploring API capabilities
 *
 * @route GET /api/analysis/test
 * @access Public
 * @returns {TestEndpointResponse} Service information and usage examples
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

/**
 * Global error handler for analysis routes
 * Catches unhandled errors from route handlers and middleware
 * Provides consistent error response format and logging
 * Prevents application crashes from propagating to clients
 *
 * @param error - The caught error object
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 * @returns void
 */
router.use((error: any, req: Request, res: Response, _: NextFunction) => {
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

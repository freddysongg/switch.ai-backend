import { Request, Response } from 'express';

import { MetricsCollectionService } from '../services/metrics.js';
import { DEFAULT_TEST_SUITES, TestingService } from '../services/testing.js';

export class MetricsController {
  private testingService: TestingService;
  private metricsService: MetricsCollectionService;

  constructor() {
    this.testingService = new TestingService();
    this.metricsService = new MetricsCollectionService();
  }

  /**
   * Run a specific test suite
   */
  async runTestSuite(req: Request, res: Response): Promise<void> {
    try {
      const { suiteId } = req.params;
      const testSuite = DEFAULT_TEST_SUITES.find((suite) => suite.id === suiteId);

      if (!testSuite) {
        res.status(404).json({
          error: 'Test suite not found',
          availableSuites: DEFAULT_TEST_SUITES.map((s) => ({ id: s.id, name: s.name }))
        });
        return;
      }

      const result = await this.testingService.runTestSuite(testSuite);
      const report = this.testingService.generateTestReport(result);

      res.json({
        success: true,
        result,
        report,
        summary: {
          passRate: ((result.passedTests / result.totalTests) * 100).toFixed(1) + '%',
          executionTime: result.executionTime + 'ms',
          averageQuality: result.summary.qualityAverages,
          averagePerformance: result.summary.performanceAverages
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to run test suite',
        message: error.message
      });
    }
  }

  /**
   * Run all test suites
   */
  async runAllTests(req: Request, res: Response): Promise<void> {
    try {
      const results = [];

      for (const testSuite of DEFAULT_TEST_SUITES) {
        const result = await this.testingService.runTestSuite(testSuite);
        results.push(result);
      }

      const overallStats = {
        totalSuites: results.length,
        totalTests: results.reduce((sum, r) => sum + r.totalTests, 0),
        totalPassed: results.reduce((sum, r) => sum + r.passedTests, 0),
        totalFailed: results.reduce((sum, r) => sum + r.failedTests, 0),
        overallPassRate: 0,
        totalExecutionTime: results.reduce((sum, r) => sum + r.executionTime, 0)
      };

      overallStats.overallPassRate = (overallStats.totalPassed / overallStats.totalTests) * 100;

      res.json({
        success: true,
        overallStats,
        suiteResults: results.map((result) => ({
          suiteId: result.suiteId,
          suiteName: result.suiteName,
          passRate: ((result.passedTests / result.totalTests) * 100).toFixed(1) + '%',
          executionTime: result.executionTime + 'ms',
          passed: result.passedTests,
          failed: result.failedTests
        })),
        detailedResults: results
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to run all tests',
        message: error.message
      });
    }
  }

  /**
   * Get available test suites
   */
  async getTestSuites(req: Request, res: Response): Promise<void> {
    try {
      const suites = DEFAULT_TEST_SUITES.map((suite) => ({
        id: suite.id,
        name: suite.name,
        description: suite.description,
        testCount: suite.testCases.length,
        categories: [...new Set(suite.testCases.map((tc) => tc.category))],
        priorities: [...new Set(suite.testCases.map((tc) => tc.priority))]
      }));

      res.json({
        success: true,
        testSuites: suites,
        totalSuites: suites.length,
        totalTests: suites.reduce((sum, s) => sum + s.testCount, 0)
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to get test suites',
        message: error.message
      });
    }
  }

  /**
   * Get metrics for a specific request
   */
  async getRequestMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { requestId } = req.params;
      const metrics = this.metricsService.getMetricsForRequest(requestId);

      if (!metrics) {
        res.status(404).json({
          success: false,
          error: 'Metrics not found for request ID'
        });
        return;
      }

      res.json({
        success: true,
        requestId,
        metrics: {
          overallScore: metrics.overallScore,
          passed: metrics.passed,
          qualityMetrics: {
            formatCompliance: metrics.qualityMetrics.formatComplianceScore,
            sectionCompleteness: metrics.qualityMetrics.sectionCompletenessScore,
            relevance: metrics.qualityMetrics.relevanceScore,
            technicalAccuracy: metrics.qualityMetrics.databaseSpecAccuracy
          },
          userExperience: {
            intentAccuracy: metrics.uxMetrics.intentClassificationAccuracy,
            queryType: metrics.uxMetrics.queryType,
            relevance: metrics.uxMetrics.queryResponseRelevance
          },
          performance: {
            responseTime: metrics.performanceMetrics.totalResponseTime,
            databaseHitRate: metrics.performanceMetrics.databaseHitRate,
            tokenUsage: metrics.performanceMetrics.tokenUsage
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to get request metrics',
        message: error.message
      });
    }
  }

  /**
   * Record manual evaluation for a request
   */
  async recordManualEvaluation(req: Request, res: Response): Promise<void> {
    try {
      const { requestId } = req.params;
      const { qualityRating, helpful, comments } = req.body;

      if (
        !qualityRating ||
        typeof qualityRating !== 'number' ||
        qualityRating < 1 ||
        qualityRating > 5
      ) {
        res.status(400).json({
          success: false,
          error: 'qualityRating must be a number between 1 and 5'
        });
        return;
      }

      if (typeof helpful !== 'boolean') {
        res.status(400).json({
          success: false,
          error: 'helpful must be a boolean value'
        });
        return;
      }

      await this.metricsService.recordManualRating(requestId, qualityRating, helpful, comments);

      res.json({
        success: true,
        message: 'Manual evaluation recorded successfully',
        evaluation: {
          requestId,
          qualityRating,
          helpful,
          comments: comments || 'No comments provided'
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to record manual evaluation',
        message: error.message
      });
    }
  }

  /**
   * Get metrics aggregation report
   */
  async getMetricsReport(req: Request, res: Response): Promise<void> {
    try {
      const { days = 7 } = req.query;
      const daysNum = parseInt(days as string, 10);

      if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
        res.status(400).json({
          success: false,
          error: 'days parameter must be a number between 1 and 365'
        });
        return;
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);

      const report = await this.metricsService.generateMetricsReport({
        start: startDate,
        end: endDate
      });

      res.json({
        success: true,
        timeRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          days: daysNum
        },
        report
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate metrics report',
        message: error.message
      });
    }
  }

  /**
   * Run a single custom test
   */
  async runCustomTest(req: Request, res: Response): Promise<void> {
    try {
      const { query, expectedIntent, expectedEntities, minimumQualityScore, mustIncludeTerms } =
        req.body;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          error: 'query is required and must be a string'
        });
        return;
      }

      const testCase = {
        id: `custom-${Date.now()}`,
        name: 'Custom Test',
        description: 'User-defined custom test case',
        category: 'manual' as const,
        query,
        expectedIntent,
        expectedEntities,
        minimumQualityScore: minimumQualityScore || 0.6,
        mustIncludeTerms,
        priority: 'medium' as const
      };

      const result = await this.testingService.runTestCase(testCase);

      res.json({
        success: true,
        testCase: {
          query: testCase.query,
          expectedIntent: testCase.expectedIntent,
          minimumQualityScore: testCase.minimumQualityScore
        },
        result: {
          passed: result.passed,
          overallScore: result.evaluationResult.overallScore,
          executionTime: result.executionTime,
          actualVsExpected: result.actualVsExpected,
          qualityBreakdown: {
            formatCompliance: result.evaluationResult.qualityMetrics.formatComplianceScore,
            sectionCompleteness: result.evaluationResult.qualityMetrics.sectionCompletenessScore,
            relevance: result.evaluationResult.qualityMetrics.relevanceScore
          },
          error: result.errorMessage
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to run custom test',
        message: error.message
      });
    }
  }

  /**
   * Get evaluation guidelines for manual testing
   */
  async getEvaluationGuidelines(req: Request, res: Response): Promise<void> {
    try {
      const { MANUAL_EVALUATION_GUIDELINES } = await import('../services/testing.js');

      res.json({
        success: true,
        guidelines: {
          content: MANUAL_EVALUATION_GUIDELINES,
          format: 'markdown',
          sections: [
            'Response Quality Evaluation (1-5 Scale)',
            'Specific Evaluation Criteria',
            'Common Issues to Flag'
          ]
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to get evaluation guidelines',
        message: error.message
      });
    }
  }

  /**
   * Health check for metrics system
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        metrics: {
          status: 'operational',
          services: {
            metricsCollection: 'available',
            testingSuite: 'available',
            predefinedTests: DEFAULT_TEST_SUITES.length
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Metrics system health check failed',
        message: error.message
      });
    }
  }
}

/**
 * Performance monitoring routes
 * 
 * Provides endpoints for accessing performance metrics, health checks,
 * and administrative functions for the ResponseParserService performance monitoring.
 * 
 * These routes are useful for:
 * - Monitoring application performance in production
 * - Debugging parsing issues during development
 * - Analyzing response transformation patterns
 * - Capacity planning and optimization
 */

import express from 'express';
import { performanceMonitor } from '../services/performanceMonitoring.js';
import { PerformanceHelpers } from '../utils/performanceHelpers.js';

const router = express.Router();

/**
 * GET /performance/stats
 * 
 * Retrieve comprehensive performance statistics
 * 
 * Query parameters:
 * - timeWindowHours (optional): Number of hours to look back (default: 24)
 * - format (optional): 'json' | 'summary' (default: 'json')
 * 
 * @example
 * GET /performance/stats?timeWindowHours=1&format=summary
 */
router.get('/stats', (req: express.Request, res: express.Response) => {
  try {
    const timeWindowHours = req.query.timeWindowHours 
      ? parseInt(req.query.timeWindowHours as string) 
      : 24;
    
    const format = req.query.format as string || 'json';

    const stats = performanceMonitor.getPerformanceStats(timeWindowHours);

    if (format === 'summary') {
      // Return a human-readable summary
      const summary = {
        overview: {
          totalOperations: stats.totalOperations,
          successRate: `${((stats.successfulOperations / Math.max(stats.totalOperations, 1)) * 100).toFixed(1)}%`,
          averageDuration: `${stats.averageDuration.toFixed(2)}ms`,
          medianDuration: `${stats.medianDuration.toFixed(2)}ms`,
          maxDuration: `${stats.maxDuration.toFixed(2)}ms`
        },
        performance: {
          averageInputSize: PerformanceHelpers.formatBytes(stats.averageInputSize),
          averageOutputSize: PerformanceHelpers.formatBytes(stats.averageOutputSize),
          compressionRatio: `${stats.compressionRatio.toFixed(2)}x`,
          averageMemory: PerformanceHelpers.formatBytes(stats.memoryUsage.averageHeapUsed),
          maxMemory: PerformanceHelpers.formatBytes(stats.memoryUsage.maxHeapUsed)
        },
        operations: stats.operationsByType,
        errors: stats.errorsByType,
        complexity: stats.performanceByComplexity,
        timeWindow: {
          start: stats.timeWindow.start.toISOString(),
          end: stats.timeWindow.end.toISOString(),
          hours: timeWindowHours
        }
      };

      res.json(summary);
    } else {
      res.json(stats);
    }
  } catch (error) {
    console.error('Error retrieving performance stats:', error);
    res.status(500).json({
      error: 'Failed to retrieve performance statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /performance/metrics/recent
 * 
 * Get recent performance metrics
 * 
 * Query parameters:
 * - limit (optional): Number of recent metrics to return (default: 10, max: 100)
 */
router.get('/metrics/recent', (req: express.Request, res: express.Response) => {
  try {
    const limit = Math.min(
      parseInt(req.query.limit as string) || 10,
      100
    );

    const recentMetrics = performanceMonitor.getRecentMetrics(limit);

    res.json({
      count: recentMetrics.length,
      metrics: recentMetrics.map(metric => ({
        ...metric,
        durationFormatted: PerformanceHelpers.formatDuration(metric.duration),
        inputSizeFormatted: PerformanceHelpers.formatBytes(metric.inputSize),
        outputSizeFormatted: PerformanceHelpers.formatBytes(metric.outputSize),
        memoryUsageFormatted: PerformanceHelpers.formatBytes(metric.memoryUsage.heapUsed)
      }))
    });
  } catch (error) {
    console.error('Error retrieving recent metrics:', error);
    res.status(500).json({
      error: 'Failed to retrieve recent metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /performance/slow-operations
 * 
 * Get operations that exceeded performance thresholds
 * 
 * Query parameters:
 * - threshold (optional): Threshold in milliseconds (default: 1000)
 */
router.get('/slow-operations', (req: express.Request, res: express.Response) => {
  try {
    const threshold = parseInt(req.query.threshold as string) || 1000;
    const slowOperations = performanceMonitor.getSlowOperations(threshold);

    res.json({
      threshold: `${threshold}ms`,
      count: slowOperations.length,
      operations: slowOperations.map(op => ({
        operationId: op.operationId,
        operation: op.operation,
        responseType: op.responseType,
        duration: `${op.duration.toFixed(2)}ms`,
        inputSize: PerformanceHelpers.formatBytes(op.inputSize),
        outputSize: PerformanceHelpers.formatBytes(op.outputSize),
        parsingComplexity: op.parsingComplexity,
        timestamp: op.timestamp.toISOString(),
        sections: op.sections,
        tables: op.tables,
        lists: op.lists
      }))
    });
  } catch (error) {
    console.error('Error retrieving slow operations:', error);
    res.status(500).json({
      error: 'Failed to retrieve slow operations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /performance/failed-operations
 * 
 * Get operations that failed
 */
router.get('/failed-operations', (req: express.Request, res: express.Response) => {
  try {
    const failedOperations = performanceMonitor.getFailedOperations();

    res.json({
      count: failedOperations.length,
      operations: failedOperations.map(op => ({
        operationId: op.operationId,
        operation: op.operation,
        responseType: op.responseType,
        errorType: op.errorType,
        duration: `${op.duration.toFixed(2)}ms`,
        inputSize: PerformanceHelpers.formatBytes(op.inputSize),
        parsingComplexity: op.parsingComplexity,
        timestamp: op.timestamp.toISOString(),
        warnings: op.warnings
      }))
    });
  } catch (error) {
    console.error('Error retrieving failed operations:', error);
    res.status(500).json({
      error: 'Failed to retrieve failed operations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /performance/health
 * 
 * Basic health check endpoint with performance indicators
 */
router.get('/health', (req: express.Request, res: express.Response) => {
  try {
    const stats = performanceMonitor.getPerformanceStats(1); // Last hour
    const recentMetrics = performanceMonitor.getRecentMetrics(5);

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      performance: {
        recentOperations: stats.totalOperations,
        successRate: stats.totalOperations > 0 
          ? `${((stats.successfulOperations / stats.totalOperations) * 100).toFixed(1)}%`
          : 'N/A',
        averageResponseTime: stats.totalOperations > 0 
          ? `${stats.averageDuration.toFixed(2)}ms`
          : 'N/A',
        memoryUsage: PerformanceHelpers.formatBytes(process.memoryUsage().heapUsed),
        uptime: PerformanceHelpers.formatDuration(process.uptime() * 1000)
      },
      warnings: [] as string[]
    };

    // Add warnings for performance issues
    if (stats.averageDuration > 2000) {
      health.warnings.push('Average response time is high (>2s)');
    }

    if (stats.failedOperations / Math.max(stats.totalOperations, 1) > 0.1) {
      health.warnings.push('High failure rate detected (>10%)');
    }

    const currentMemory = process.memoryUsage().heapUsed;
    if (currentMemory > 500 * 1024 * 1024) { // 500MB
      health.warnings.push('High memory usage detected (>500MB)');
    }

    if (health.warnings.length > 0) {
      health.status = 'warning';
    }

    res.json(health);
  } catch (error) {
    console.error('Error checking health:', error);
    res.status(500).json({
      status: 'error',
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /performance/clear
 * 
 * Clear performance metrics history (admin endpoint)
 */
router.post('/clear', (req: express.Request, res: express.Response) => {
  try {
    performanceMonitor.clearMetrics();
    
    res.json({
      message: 'Performance metrics cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error clearing metrics:', error);
    res.status(500).json({
      error: 'Failed to clear metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /performance/export
 * 
 * Export all performance metrics for external analysis
 */
router.get('/export', (req: express.Request, res: express.Response) => {
  try {
    const metrics = performanceMonitor.exportMetrics();
    
    const filename = `performance-metrics-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    
    res.json({
      exportedAt: new Date().toISOString(),
      totalMetrics: metrics.length,
      metrics
    });
  } catch (error) {
    console.error('Error exporting metrics:', error);
    res.status(500).json({
      error: 'Failed to export metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /performance/operations/:operationType
 * 
 * Get metrics for a specific operation type
 */
router.get('/operations/:operationType', (req: express.Request, res: express.Response): void => {
  try {
    const operationType = req.params.operationType as any;
    const validOperations = [
      'parseMarkdown',
      'transformToSwitchComparison',
      'transformToCharacteristicsExplanation',
      'transformToMaterialAnalysis',
      'transformToStandardRAG'
    ];

    if (!validOperations.includes(operationType)) {
      res.status(400).json({
        error: 'Invalid operation type',
        validOperations
      });
      return;
    }

    const metrics = performanceMonitor.getMetricsByOperation(operationType);

    const summary = {
      operation: operationType,
      totalExecutions: metrics.length,
      successfulExecutions: metrics.filter(m => m.success).length,
      failedExecutions: metrics.filter(m => !m.success).length,
      averageDuration: metrics.length > 0 
        ? metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length 
        : 0,
      averageInputSize: metrics.length > 0 
        ? metrics.reduce((sum, m) => sum + m.inputSize, 0) / metrics.length 
        : 0,
      averageOutputSize: metrics.length > 0 
        ? metrics.reduce((sum, m) => sum + m.outputSize, 0) / metrics.length 
        : 0,
      recentMetrics: metrics.slice(-10).map(metric => ({
        operationId: metric.operationId,
        duration: `${metric.duration.toFixed(2)}ms`,
        success: metric.success,
        parsingComplexity: metric.parsingComplexity,
        timestamp: metric.timestamp.toISOString()
      }))
    };

    res.json(summary);
  } catch (error) {
    console.error('Error retrieving operation metrics:', error);
    res.status(500).json({
      error: 'Failed to retrieve operation metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 
import { ResponseType } from '../config/responseStructures.js';
import { 
  ParsePerformanceMetrics, 
  PerformanceStats, 
  PerformanceMonitoringOptions 
} from '../types/performance.js';
import { PerformanceHelpers } from '../utils/performanceHelpers.js';

/**
 * Performance monitoring service for parsing operations
 * 
 * Tracks response times, memory usage, and provides analytics for
 * ResponseParserService operations. Maintains in-memory metrics
 * with configurable history limits and analysis capabilities.
 * 
 * Features:
 * - Real-time operation tracking
 * - Memory usage monitoring
 * - Error classification and counting
 * - Performance statistics and analytics
 * - Configurable logging and history
 * 
 * @example
 * ```typescript
 * const monitor = new PerformanceMonitoringService();
 * const opId = monitor.startOperation('parseMarkdown', 'switch_comparison', 1024);
 * // ... perform operation
 * monitor.completeOperation(opId, { outputSize: 512, success: true });
 * ```
 */
export class PerformanceMonitoringService {
  private metrics: ParsePerformanceMetrics[] = [];
  private readonly maxMetricsHistory: number;
  private readonly enableDetailedLogging: boolean;
  private readonly enableMemoryTracking: boolean;
  private operationCounter = 0;

  constructor(options: PerformanceMonitoringOptions = {}) {
    this.maxMetricsHistory = options.maxMetricsHistory ?? 1000;
    this.enableDetailedLogging = options.enableDetailedLogging ?? true;
    this.enableMemoryTracking = options.enableMemoryTracking ?? true;
  }

  /**
   * Starts monitoring a parsing operation
   * 
   * Creates a unique operation ID and records the start time and memory state.
   * 
   * @param operation - Type of operation being performed
   * @param responseType - Response type being generated
   * @param inputSize - Size of input data in bytes
   * @returns Unique operation ID for tracking
   */
  public startOperation(
    operation: ParsePerformanceMetrics['operation'], 
    responseType: ResponseType, 
    inputSize: number
  ): string {
    const operationId = `${operation}_${++this.operationCounter}_${Date.now()}`;
    
    const startTime = performance.now();
    const memoryUsage = this.enableMemoryTracking ? process.memoryUsage() : {
      heapUsed: 0,
      heapTotal: 0,
      rss: 0
    };

    if (this.enableDetailedLogging) {
      console.log(
        `🚀 Started ${operation} operation [${operationId}] - ` +
        `Input: ${PerformanceHelpers.formatBytes(inputSize)}, ` +
        `Memory: ${PerformanceHelpers.formatBytes(memoryUsage.heapUsed)}`
      );
    }

    return operationId;
  }

  /**
   * Completes monitoring of a parsing operation
   * 
   * Records the completion time, calculates metrics, and stores the results.
   * 
   * @param operationId - ID from startOperation call
   * @param options - Completion details including success status and output size
   * @returns Complete performance metrics for the operation
   */
  public completeOperation(
    operationId: string,
    options: {
      outputSize: number;
      success: boolean;
      errorType?: string;
      warnings?: number;
      sections?: number;
      tables?: number;
      lists?: number;
    }
  ): ParsePerformanceMetrics {
    const endTime = performance.now();
    const endMemoryUsage = this.enableMemoryTracking ? process.memoryUsage() : {
      heapUsed: 0,
      heapTotal: 0,
      rss: 0
    };

    // Find existing operation or create minimal data
    const existingMetric = this.metrics.find(m => m.operationId === operationId);
    const startTime = existingMetric?.startTime ?? endTime;
    const duration = endTime - startTime;

    // Determine parsing complexity
    const parsingComplexity = PerformanceHelpers.determineComplexity(
      options.sections ?? 0,
      options.tables ?? 0,
      options.lists ?? 0,
      options.outputSize
    );

    const completedMetrics: ParsePerformanceMetrics = {
      operationId,
      operation: existingMetric?.operation ?? 'parseMarkdown',
      responseType: existingMetric?.responseType ?? 'standard_rag',
      startTime,
      endTime,
      duration,
      inputSize: existingMetric?.inputSize ?? 0,
      outputSize: options.outputSize,
      memoryUsage: endMemoryUsage,
      success: options.success,
      errorType: options.errorType,
      warnings: options.warnings ?? 0,
      parsingComplexity,
      sections: options.sections ?? 0,
      tables: options.tables ?? 0,
      lists: options.lists ?? 0,
      timestamp: existingMetric?.timestamp ?? new Date()
    };

    this.addMetrics(completedMetrics);

    if (this.enableDetailedLogging) {
      const status = options.success ? '✅' : '❌';
      const memoryDelta = endMemoryUsage.heapUsed - (existingMetric?.memoryUsage?.heapUsed ?? 0);
      console.log(
        `${status} Completed ${completedMetrics.operation} [${operationId}] - ` +
        `Duration: ${PerformanceHelpers.formatDuration(duration)}, ` +
        `Output: ${PerformanceHelpers.formatBytes(options.outputSize)}, ` +
        `Memory Δ: ${PerformanceHelpers.formatBytes(memoryDelta)}, ` +
        `Complexity: ${parsingComplexity}`
      );
    }

    return completedMetrics;
  }

  /**
   * Adds metrics to storage with automatic cleanup
   * 
   * @param metrics - Performance metrics to store
   */
  private addMetrics(metrics: ParsePerformanceMetrics): void {
    this.metrics.push(metrics);

    // Clean up old metrics if we exceed the limit
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }
  }

  /**
   * Gets comprehensive performance statistics for a time window
   * 
   * @param timeWindowHours - Hours to look back (optional, defaults to all data)
   * @returns Aggregated performance statistics
   */
  public getPerformanceStats(timeWindowHours?: number): PerformanceStats {
    const now = new Date();
    const timeWindowStart = timeWindowHours 
      ? new Date(now.getTime() - (timeWindowHours * 60 * 60 * 1000))
      : new Date(0);

    const relevantMetrics = this.metrics.filter(m => 
      m.timestamp >= timeWindowStart
    );

    if (relevantMetrics.length === 0) {
      return this.getEmptyStats(timeWindowStart, now);
    }

    const durations = relevantMetrics.map(m => m.duration);
    const inputSizes = relevantMetrics.map(m => m.inputSize);
    const outputSizes = relevantMetrics.map(m => m.outputSize);

    const totalOperations = relevantMetrics.length;
    const successfulOperations = relevantMetrics.filter(m => m.success).length;
    const failedOperations = totalOperations - successfulOperations;

    const averageDuration = PerformanceHelpers.calculateAverage(durations);
    const medianDuration = PerformanceHelpers.calculateMedian(durations);
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);

    const averageInputSize = PerformanceHelpers.calculateAverage(inputSizes);
    const averageOutputSize = PerformanceHelpers.calculateAverage(outputSizes);
    const compressionRatio = averageInputSize > 0 ? averageOutputSize / averageInputSize : 1;

    // Operation type breakdown
    const operationsByType: Record<string, number> = {};
    relevantMetrics.forEach(m => {
      operationsByType[m.operation] = (operationsByType[m.operation] || 0) + 1;
    });

    // Error type breakdown
    const errorsByType: Record<string, number> = {};
    relevantMetrics.filter(m => !m.success && m.errorType).forEach(m => {
      errorsByType[m.errorType!] = (errorsByType[m.errorType!] || 0) + 1;
    });

    // Performance by complexity
    const performanceByComplexity: Record<string, {
      count: number;
      averageDuration: number;
      averageMemoryUsage: number;
    }> = {};

    ['low', 'medium', 'high'].forEach(complexity => {
      const complexityMetrics = relevantMetrics.filter(m => m.parsingComplexity === complexity);
      if (complexityMetrics.length > 0) {
        performanceByComplexity[complexity] = {
          count: complexityMetrics.length,
          averageDuration: PerformanceHelpers.calculateAverage(complexityMetrics.map(m => m.duration)),
          averageMemoryUsage: PerformanceHelpers.calculateAverage(complexityMetrics.map(m => m.memoryUsage.heapUsed))
        };
      }
    });

    // Memory usage statistics
    const heapUsages = relevantMetrics.map(m => m.memoryUsage.heapUsed);
    const rssUsages = relevantMetrics.map(m => m.memoryUsage.rss);

    return {
      totalOperations,
      successfulOperations,
      failedOperations,
      averageDuration,
      medianDuration,
      maxDuration,
      minDuration,
      averageInputSize,
      averageOutputSize,
      compressionRatio,
      operationsByType,
      errorsByType,
      performanceByComplexity,
      memoryUsage: {
        averageHeapUsed: PerformanceHelpers.calculateAverage(heapUsages),
        maxHeapUsed: Math.max(...heapUsages),
        averageRss: PerformanceHelpers.calculateAverage(rssUsages),
        maxRss: Math.max(...rssUsages)
      },
      timeWindow: {
        start: timeWindowStart,
        end: now
      }
    };
  }

  /**
   * Gets recent performance metrics
   * 
   * @param limit - Maximum number of metrics to return
   * @returns Array of recent metrics, newest first
   */
  public getRecentMetrics(limit: number = 10): ParsePerformanceMetrics[] {
    return this.metrics
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Gets metrics filtered by operation type
   * 
   * @param operation - Operation type to filter by
   * @returns Array of metrics for the specified operation
   */
  public getMetricsByOperation(operation: ParsePerformanceMetrics['operation']): ParsePerformanceMetrics[] {
    return this.metrics.filter(m => m.operation === operation);
  }

  /**
   * Gets operations that exceeded performance thresholds
   * 
   * @param thresholdMs - Duration threshold in milliseconds
   * @returns Array of slow operations
   */
  public getSlowOperations(thresholdMs: number = 1000): ParsePerformanceMetrics[] {
    return this.metrics.filter(m => m.duration > thresholdMs);
  }

  /**
   * Gets operations that failed
   * 
   * @returns Array of failed operations
   */
  public getFailedOperations(): ParsePerformanceMetrics[] {
    return this.metrics.filter(m => !m.success);
  }

  /**
   * Logs a performance summary to the console
   * 
   * @param timeWindowHours - Hours to look back for statistics
   */
  public logPerformanceSummary(timeWindowHours?: number): void {
    const stats = this.getPerformanceStats(timeWindowHours);
    
    console.log('\n📊 Performance Summary:');
    console.log(`├─ Total Operations: ${stats.totalOperations}`);
    console.log(`├─ Success Rate: ${((stats.successfulOperations / Math.max(stats.totalOperations, 1)) * 100).toFixed(1)}%`);
    console.log(`├─ Average Duration: ${PerformanceHelpers.formatDuration(stats.averageDuration)}`);
    console.log(`├─ Median Duration: ${PerformanceHelpers.formatDuration(stats.medianDuration)}`);
    console.log(`├─ Max Duration: ${PerformanceHelpers.formatDuration(stats.maxDuration)}`);
    console.log(`├─ Average Input Size: ${PerformanceHelpers.formatBytes(stats.averageInputSize)}`);
    console.log(`├─ Average Output Size: ${PerformanceHelpers.formatBytes(stats.averageOutputSize)}`);
    console.log(`├─ Compression Ratio: ${stats.compressionRatio.toFixed(2)}x`);
    console.log(`├─ Average Memory: ${PerformanceHelpers.formatBytes(stats.memoryUsage.averageHeapUsed)}`);
    console.log(`└─ Max Memory: ${PerformanceHelpers.formatBytes(stats.memoryUsage.maxHeapUsed)}`);

    if (Object.keys(stats.operationsByType).length > 0) {
      console.log('\n🔧 Operations by Type:');
      Object.entries(stats.operationsByType).forEach(([type, count]) => {
        console.log(`  ├─ ${type}: ${count}`);
      });
    }

    if (Object.keys(stats.errorsByType).length > 0) {
      console.log('\n❌ Errors by Type:');
      Object.entries(stats.errorsByType).forEach(([type, count]) => {
        console.log(`  ├─ ${type}: ${count}`);
      });
    }

    if (Object.keys(stats.performanceByComplexity).length > 0) {
      console.log('\n⚡ Performance by Complexity:');
      Object.entries(stats.performanceByComplexity).forEach(([complexity, data]) => {
        console.log(
          `  ├─ ${complexity}: ${data.count} ops, ` +
          `${PerformanceHelpers.formatDuration(data.averageDuration)} avg, ` +
          `${PerformanceHelpers.formatBytes(data.averageMemoryUsage)} mem`
        );
      });
    }

    console.log('');
  }

  /**
   * Clears all stored metrics
   */
  public clearMetrics(): void {
    this.metrics = [];
    this.operationCounter = 0;
    console.log('🧹 Performance metrics history cleared');
  }

  /**
   * Exports all metrics for external analysis
   * 
   * @returns Copy of all stored metrics
   */
  public exportMetrics(): ParsePerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Creates empty statistics structure
   * 
   * @param start - Start of time window
   * @param end - End of time window
   * @returns Empty statistics object
   */
  private getEmptyStats(start: Date, end: Date): PerformanceStats {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageDuration: 0,
      medianDuration: 0,
      maxDuration: 0,
      minDuration: 0,
      averageInputSize: 0,
      averageOutputSize: 0,
      compressionRatio: 1,
      operationsByType: {},
      errorsByType: {},
      performanceByComplexity: {},
      memoryUsage: {
        averageHeapUsed: 0,
        maxHeapUsed: 0,
        averageRss: 0,
        maxRss: 0
      },
      timeWindow: {
        start,
        end
      }
    };
  }
}

/**
 * Global performance monitoring instance
 * 
 * Pre-configured instance for immediate use throughout the application.
 * Uses development-friendly settings that can be overridden for production.
 */
export const performanceMonitor = new PerformanceMonitoringService({
  maxMetricsHistory: 1000,
  enableDetailedLogging: process.env.NODE_ENV !== 'production',
  enableMemoryTracking: true
});

/**
 * Performance monitoring decorator for async functions
 * 
 * Automatically instruments async methods with performance tracking.
 * 
 * @param operation - Type of operation being monitored
 * @param responseType - Response type being generated
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * class MyService {
 *   @monitorPerformance('parseMarkdown', 'switch_comparison')
 *   async parseContent(content: string): Promise<any> {
 *     // Method implementation
 *   }
 * }
 * ```
 */
export function monitorPerformance<T extends any[], R>(
  operation: ParsePerformanceMetrics['operation'],
  responseType: ResponseType
) {
  return function (target: any, propertyName: string, descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>) {
    const method = descriptor.value!;
    
    descriptor.value = async function (...args: T): Promise<R> {
      const inputSize = JSON.stringify(args).length;
      const operationId = performanceMonitor.startOperation(operation, responseType, inputSize);
      
      try {
        const result = await method.apply(this, args);
        const outputSize = JSON.stringify(result).length;
        
        performanceMonitor.completeOperation(operationId, {
          outputSize,
          success: true,
          warnings: 0
        });
        
        return result;
      } catch (error) {
        performanceMonitor.completeOperation(operationId, {
          outputSize: 0,
          success: false,
          errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
        });
        
        throw error;
      }
    };
    
    return descriptor;
  };
} 
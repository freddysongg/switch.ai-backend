import { ResponseType } from '../config/responseStructures.js';

/**
 * Performance metrics for individual parsing operations
 * 
 * Tracks detailed metrics for each parsing operation including
 * timing, memory usage, complexity, and success indicators.
 */
export interface ParsePerformanceMetrics {
  /** Unique identifier for this operation */
  operationId: string;
  
  /** Type of operation being performed */
  operation: 'parseMarkdown' | 'transformToSwitchComparison' | 'transformToCharacteristicsExplanation' | 'transformToMaterialAnalysis' | 'transformToStandardRAG';
  
  /** Response type being generated */
  responseType: ResponseType;
  
  /** Start time in milliseconds (performance.now()) */
  startTime: number;
  
  /** End time in milliseconds (performance.now()) */
  endTime: number;
  
  /** Total duration in milliseconds */
  duration: number;
  
  /** Size of input data in bytes */
  inputSize: number;
  
  /** Size of output data in bytes */
  outputSize: number;
  
  /** Memory usage snapshot at completion */
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
  
  /** Whether the operation completed successfully */
  success: boolean;
  
  /** Type of error if operation failed */
  errorType?: string;
  
  /** Number of warnings encountered */
  warnings: number;
  
  /** Complexity classification of the parsed content */
  parsingComplexity: 'low' | 'medium' | 'high';
  
  /** Number of sections found in content */
  sections: number;
  
  /** Number of tables found in content */
  tables: number;
  
  /** Number of lists found in content */
  lists: number;
  
  /** Timestamp when operation was completed */
  timestamp: Date;
}

/**
 * Aggregated performance statistics over a time window
 * 
 * Provides comprehensive performance analysis including
 * averages, distributions, and breakdowns by various dimensions.
 */
export interface PerformanceStats {
  /** Total number of operations in the time window */
  totalOperations: number;
  
  /** Number of successful operations */
  successfulOperations: number;
  
  /** Number of failed operations */
  failedOperations: number;
  
  /** Average operation duration in milliseconds */
  averageDuration: number;
  
  /** Median operation duration in milliseconds */
  medianDuration: number;
  
  /** Maximum operation duration in milliseconds */
  maxDuration: number;
  
  /** Minimum operation duration in milliseconds */
  minDuration: number;
  
  /** Average input size in bytes */
  averageInputSize: number;
  
  /** Average output size in bytes */
  averageOutputSize: number;
  
  /** Ratio of output size to input size */
  compressionRatio: number;
  
  /** Count of operations by operation type */
  operationsByType: Record<string, number>;
  
  /** Count of errors by error type */
  errorsByType: Record<string, number>;
  
  /** Performance metrics grouped by parsing complexity */
  performanceByComplexity: Record<string, {
    count: number;
    averageDuration: number;
    averageMemoryUsage: number;
  }>;
  
  /** Memory usage statistics */
  memoryUsage: {
    averageHeapUsed: number;
    maxHeapUsed: number;
    averageRss: number;
    maxRss: number;
  };
  
  /** Time window for these statistics */
  timeWindow: {
    start: Date;
    end: Date;
  };
}

/**
 * Configuration options for PerformanceMonitoringService
 */
export interface PerformanceMonitoringOptions {
  /** Maximum number of metrics to store in memory */
  maxMetricsHistory?: number;
  
  /** Enable detailed console logging */
  enableDetailedLogging?: boolean;
  
  /** Enable memory usage tracking */
  enableMemoryTracking?: boolean;
} 
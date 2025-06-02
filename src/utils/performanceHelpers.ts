/**
 * Performance utility functions for formatting and calculations
 * 
 * Provides reusable helper functions for performance monitoring,
 * including formatters for display and statistical calculations.
 */

/**
 * Helper functions for performance monitoring operations
 */
export class PerformanceHelpers {
  /**
   * Formats bytes into human-readable string with appropriate units
   * 
   * @param bytes - Number of bytes to format
   * @returns Formatted string with units (B, KB, MB, GB)
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Formats duration in milliseconds to human-readable string
   * 
   * @param ms - Duration in milliseconds
   * @returns Formatted string with appropriate time units
   */
  static formatDuration(ms: number): string {
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  }

  /**
   * Calculates a specific percentile from an array of values
   * 
   * @param values - Array of numeric values
   * @param percentile - Percentile to calculate (0-100)
   * @returns Value at the specified percentile
   */
  static calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Determines parsing complexity based on content analysis
   * 
   * @param sections - Number of sections in content
   * @param tables - Number of tables in content
   * @param lists - Number of lists in content
   * @param outputSize - Size of generated output in bytes
   * @returns Complexity classification
   */
  static determineComplexity(
    sections: number, 
    tables: number, 
    lists: number, 
    outputSize: number
  ): 'low' | 'medium' | 'high' {
    const structuralComplexity = sections + (tables * 2) + lists;
    const sizeComplexity = outputSize / 1000; // KB scale

    const totalComplexity = structuralComplexity + sizeComplexity;

    if (totalComplexity < 5) return 'low';
    if (totalComplexity < 20) return 'medium';
    return 'high';
  }

  /**
   * Calculates median value from an array of numbers
   * 
   * @param values - Array of numeric values
   * @returns Median value
   */
  static calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    
    return sorted[middle];
  }

  /**
   * Calculates average value from an array of numbers
   * 
   * @param values - Array of numeric values
   * @returns Average value
   */
  static calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
} 
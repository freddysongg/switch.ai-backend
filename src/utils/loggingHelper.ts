/**
 * Logging Helper Utility for Switch Analysis Feature
 *
 * This utility provides standardized console logging throughout the analysis process
 * with detailed step-by-step tracking for debugging purposes.
 */

import type {
  AnalysisRequest,
  AnalysisWorkflow,
  DatabaseContext,
  LLMResponse,
  LogEntry,
  LogLevel,
  ProcessingStep,
  StepLog
} from '../types/analysisTypes.js';

export class LoggingHelper {
  private static readonly LOG_PREFIX = '[SwitchAnalysis]';

  /**
   * Log analysis request receipt (FR5.1)
   * @param request The incoming analysis request
   * @param requestId Unique identifier for this request
   */
  static logRequestReceived(request: AnalysisRequest, requestId: string): void {
    // TODO: Implement request logging
    // - Log user query (sanitized)
    // - Include request metadata
    // - Record timestamp and request ID
    // - Use appropriate log level

    console.log(`${this.LOG_PREFIX} [${requestId}] Request received - Implementation needed`);
  }

  /**
   * Log intent recognition results (FR5.2)
   * @param requestId Request identifier
   * @param intent Recognized intent
   * @param confidence Confidence score
   * @param entities Extracted entities
   */
  static logIntentRecognition(
    requestId: string,
    intent: string,
    confidence: number,
    entities: any
  ): void {
    // TODO: Implement intent recognition logging
    // - Log determined intent and confidence
    // - Include extracted entities (switches, materials, etc.)
    // - Record processing time
    // - Format for easy debugging

    console.log(`${this.LOG_PREFIX} [${requestId}] Intent recognition - Implementation needed`);
  }

  /**
   * Log database lookup results (FR5.2)
   * @param requestId Request identifier
   * @param lookupResults Database lookup results
   * @param lookupTimeMs Time taken for lookup
   */
  static logDatabaseLookup(
    requestId: string,
    lookupResults: DatabaseContext,
    lookupTimeMs: number
  ): void {
    const successRate =
      lookupResults.totalRequested > 0
        ? Math.round((lookupResults.totalFound / lookupResults.totalRequested) * 100)
        : 0;

    console.log(`${this.LOG_PREFIX} [${requestId}] Database lookup completed in ${lookupTimeMs}ms`);
    console.log(
      `${this.LOG_PREFIX} [${requestId}] Results: ${lookupResults.totalFound}/${lookupResults.totalRequested} switches found (${successRate}% success rate)`
    );

    if (lookupResults.switches.length > 0) {
      const foundSwitches = lookupResults.switches
        .filter((s) => s.found)
        .map((s) => `${s.normalizedName} (${Math.round(s.confidence * 100)}%)`)
        .join(', ');

      const notFoundSwitches = lookupResults.switches
        .filter((s) => !s.found)
        .map((s) => s.normalizedName)
        .join(', ');

      if (foundSwitches) {
        console.log(`${this.LOG_PREFIX} [${requestId}] Found switches: ${foundSwitches}`);
      }

      if (notFoundSwitches) {
        console.log(`${this.LOG_PREFIX} [${requestId}] Not found: ${notFoundSwitches}`);
      }
    }
  }

  /**
   * Log prompt construction details (FR5.2)
   * @param requestId Request identifier
   * @param promptLength Length of constructed prompt
   * @param includesDbData Whether database data was included
   * @param intent Query intent for this prompt
   */
  static logPromptConstruction(
    requestId: string,
    promptLength: number,
    includesDbData: boolean,
    intent: string
  ): void {
    console.log(`${this.LOG_PREFIX} [${requestId}] Prompt construction completed`);
    console.log(
      `${this.LOG_PREFIX} [${requestId}] Intent: ${intent}, Length: ${promptLength} chars, DB data: ${includesDbData ? 'included' : 'not included'}`
    );

    // Log prompt characteristics without exposing full content
    const sizeCategory =
      promptLength < 1000
        ? 'small'
        : promptLength < 3000
          ? 'medium'
          : promptLength < 6000
            ? 'large'
            : 'very large';

    console.log(
      `${this.LOG_PREFIX} [${requestId}] Prompt size: ${sizeCategory}, estimated tokens: ~${Math.ceil(promptLength / 4)}`
    );
  }

  /**
   * Log LLM interaction details (FR5.3)
   * @param requestId Request identifier
   * @param llmResponse Raw LLM response with usage metrics
   * @param responseTimeMs Time taken for LLM generation
   */
  static logLLMResponse(requestId: string, llmResponse: LLMResponse, responseTimeMs: number): void {
    console.log(`${this.LOG_PREFIX} [${requestId}] LLM response received in ${responseTimeMs}ms`);

    if (llmResponse.usage) {
      console.log(
        `${this.LOG_PREFIX} [${requestId}] Token usage - Prompt: ${llmResponse.usage.promptTokens}, Completion: ${llmResponse.usage.completionTokens}, Total: ${llmResponse.usage.totalTokens}`
      );
    }

    console.log(
      `${this.LOG_PREFIX} [${requestId}] Response length: ${llmResponse.content.length} chars, Finish reason: ${llmResponse.finishReason || 'unknown'}`
    );

    // Calculate tokens per second for performance monitoring
    if (llmResponse.usage?.completionTokens && responseTimeMs > 0) {
      const tokensPerSecond = Math.round(
        (llmResponse.usage.completionTokens / responseTimeMs) * 1000
      );
      console.log(
        `${this.LOG_PREFIX} [${requestId}] Generation speed: ${tokensPerSecond} tokens/second`
      );
    }

    // Log any potential issues
    if (responseTimeMs > 30000) {
      console.warn(
        `${this.LOG_PREFIX} [${requestId}] Slow LLM response (${responseTimeMs}ms) - consider optimization`
      );
    }

    if (llmResponse.finishReason === 'length') {
      console.warn(`${this.LOG_PREFIX} [${requestId}] LLM response truncated due to length limit`);
    }
  }

  /**
   * Log processing step updates (FR5.1)
   * @param requestId Request identifier
   * @param stepName Name of the processing step
   * @param status Current status of the step
   * @param data Optional step-specific data
   * @param error Optional error information
   */
  static logProcessingStep(
    requestId: string,
    stepName: string,
    status: 'pending' | 'in_progress' | 'completed' | 'failed',
    data?: any,
    error?: string
  ): void {
    const timestamp = new Date().toISOString();
    const statusIcon =
      status === 'completed'
        ? '✅'
        : status === 'failed'
          ? '❌'
          : status === 'in_progress'
            ? '🔄'
            : '⏳';

    console.log(
      `${this.LOG_PREFIX} [${requestId}] ${statusIcon} ${stepName}: ${status.toUpperCase()} (${timestamp})`
    );

    if (data) {
      // Log relevant data without overwhelming output
      if (typeof data === 'object') {
        const dataKeys = Object.keys(data);
        if (dataKeys.length <= 3) {
          console.log(`${this.LOG_PREFIX} [${requestId}] Step data:`, data);
        } else {
          console.log(`${this.LOG_PREFIX} [${requestId}] Step data keys: ${dataKeys.join(', ')}`);
        }
      } else {
        console.log(`${this.LOG_PREFIX} [${requestId}] Step data: ${data}`);
      }
    }

    if (error) {
      console.error(`${this.LOG_PREFIX} [${requestId}] Step error: ${error}`);
    }
  }

  /**
   * Log workflow completion summary (FR5.1)
   * @param workflow Complete workflow with all steps and timing
   */
  static logWorkflowCompletion(workflow: AnalysisWorkflow): void {
    const totalTime = workflow.totalDurationMs || 0;
    const status = workflow.endTime ? 'COMPLETED' : 'IN_PROGRESS';

    console.log(
      `${this.LOG_PREFIX} [${workflow.requestId}] ========== WORKFLOW ${status} ==========`
    );
    console.log(`${this.LOG_PREFIX} [${workflow.requestId}] Query: "${workflow.userQuery}"`);
    console.log(`${this.LOG_PREFIX} [${workflow.requestId}] Total duration: ${totalTime}ms`);

    // Log step-by-step breakdown
    const stepEntries = Object.entries(workflow.steps);
    stepEntries.forEach(([stepName, stepData]) => {
      const stepDuration =
        stepData.endTime && stepData.startTime
          ? stepData.endTime.getTime() - stepData.startTime.getTime()
          : 'unknown';

      const stepIcon =
        stepData.status === 'completed' ? '✅' : stepData.status === 'failed' ? '❌' : '⏳';

      console.log(
        `${this.LOG_PREFIX} [${workflow.requestId}] ${stepIcon} ${stepName}: ${stepData.status} (${stepDuration}ms)`
      );
    });

    // Performance summary
    if (totalTime > 0) {
      const performance = totalTime < 3000 ? 'FAST' : totalTime < 8000 ? 'MODERATE' : 'SLOW';
      console.log(`${this.LOG_PREFIX} [${workflow.requestId}] Performance: ${performance}`);
    }

    console.log(
      `${this.LOG_PREFIX} [${workflow.requestId}] ========================================`
    );
  }

  /**
   * Log errors with context (FR5.2)
   * @param requestId Request identifier
   * @param error Error object or message
   * @param step Processing step where error occurred
   * @param context Additional context for debugging
   */
  static logError(requestId: string, error: any, step: string, context?: any): void {
    const timestamp = new Date().toISOString();
    console.error(`${this.LOG_PREFIX} [${requestId}] ❌ ERROR in ${step} (${timestamp})`);

    if (error instanceof Error) {
      console.error(`${this.LOG_PREFIX} [${requestId}] Error name: ${error.name}`);
      console.error(`${this.LOG_PREFIX} [${requestId}] Error message: ${error.message}`);
      if (error.stack) {
        console.error(`${this.LOG_PREFIX} [${requestId}] Stack trace:`, error.stack);
      }
    } else if (typeof error === 'string') {
      console.error(`${this.LOG_PREFIX} [${requestId}] Error: ${error}`);
    } else {
      console.error(`${this.LOG_PREFIX} [${requestId}] Error:`, error);
    }

    if (context) {
      console.error(`${this.LOG_PREFIX} [${requestId}] Context:`, context);
    }
  }

  /**
   * Log warning conditions (FR5.2)
   * @param requestId Request identifier
   * @param message Warning message
   * @param step Processing step context
   * @param data Additional warning data
   */
  static logWarning(requestId: string, message: string, step: string, data?: any): void {
    const timestamp = new Date().toISOString();
    console.warn(
      `${this.LOG_PREFIX} [${requestId}] ⚠️  WARNING in ${step}: ${message} (${timestamp})`
    );

    if (data) {
      console.warn(`${this.LOG_PREFIX} [${requestId}] Warning data:`, data);
    }
  }

  /**
   * Create structured log entry (FR5.1)
   * @param level Log level
   * @param step Processing step
   * @param message Log message
   * @param data Optional additional data
   * @param requestId Optional request identifier
   * @param userId Optional user identifier
   * @returns Structured log entry
   */
  static createLogEntry(
    level: LogLevel,
    step: string,
    message: string,
    data?: any,
    requestId?: string,
    userId?: string
  ): LogEntry {
    return {
      timestamp: new Date(),
      level,
      step,
      message,
      data,
      requestId,
      userId
    };
  }

  /**
   * Format log output for console display
   * @param entry Log entry to format
   * @returns Formatted log string
   */
  static formatLogOutput(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const levelIcon =
      entry.level === 'error'
        ? '❌'
        : entry.level === 'warn'
          ? '⚠️'
          : entry.level === 'info'
            ? 'ℹ️'
            : '🔍';

    let formattedMessage = `${this.LOG_PREFIX} ${levelIcon} [${entry.level.toUpperCase()}] ${timestamp}`;

    if (entry.requestId) {
      formattedMessage += ` [${entry.requestId}]`;
    }

    if (entry.userId) {
      formattedMessage += ` [User:${entry.userId}]`;
    }

    formattedMessage += ` [${entry.step}] ${entry.message}`;

    if (entry.data) {
      formattedMessage += `\n${this.LOG_PREFIX} Data: ${JSON.stringify(entry.data, null, 2)}`;
    }

    return formattedMessage;
  }

  /**
   * Generate request ID for workflow tracking
   * @returns Unique request identifier
   */
  static generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 5);
    return `req_${timestamp}_${randomPart}`;
  }

  /**
   * Log system performance metrics
   * @param requestId Request identifier
   * @param metrics Performance metrics object
   */
  static logPerformanceMetrics(requestId: string, metrics: any): void {
    console.log(`${this.LOG_PREFIX} [${requestId}] 📊 Performance metrics:`);

    if (metrics.totalDuration) {
      console.log(`${this.LOG_PREFIX} [${requestId}] Total duration: ${metrics.totalDuration}ms`);
    }

    if (metrics.databaseLookupTime) {
      console.log(
        `${this.LOG_PREFIX} [${requestId}] Database lookup: ${metrics.databaseLookupTime}ms`
      );
    }

    if (metrics.llmResponseTime) {
      console.log(`${this.LOG_PREFIX} [${requestId}] LLM response: ${metrics.llmResponseTime}ms`);
    }

    if (metrics.tokenUsage) {
      console.log(
        `${this.LOG_PREFIX} [${requestId}] Token usage: ${JSON.stringify(metrics.tokenUsage)}`
      );
    }

    if (metrics.memoryUsage) {
      console.log(
        `${this.LOG_PREFIX} [${requestId}] Memory usage: ${JSON.stringify(metrics.memoryUsage)}`
      );
    }

    // Log any custom metrics
    Object.entries(metrics).forEach(([key, value]) => {
      if (
        ![
          'totalDuration',
          'databaseLookupTime',
          'llmResponseTime',
          'tokenUsage',
          'memoryUsage'
        ].includes(key)
      ) {
        console.log(`${this.LOG_PREFIX} [${requestId}] ${key}: ${value}`);
      }
    });
  }
}

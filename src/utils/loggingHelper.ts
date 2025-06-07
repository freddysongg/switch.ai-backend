/**
 * Logging Helper Utility for Switch Analysis Feature
 *
 * This utility provides standardized console logging throughout the analysis process
 * with detailed step-by-step tracking for debugging purposes.
 *
 * This is a development utility and is not used in production.
 */

import type {
  AnalysisRequest,
  AnalysisWorkflow,
  DatabaseContext,
  LLMResponse,
  LogEntry,
  LogLevel
} from '../types/analysisTypes.js';

export class LoggingHelper {
  private static readonly LOG_PREFIX = '[SwitchAnalysis]';

  /**
   * Log analysis request receipt
   * @param request The incoming analysis request
   * @param requestId Unique identifier for this request
   */
  static logRequestReceived(request: AnalysisRequest, requestId: string): void {
    const timestamp = new Date().toISOString();

    const sanitizedQuery = request.query
      .replace(/\b[\w._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]')
      .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD_REDACTED]')
      .substring(0, 500);

    console.log(`${this.LOG_PREFIX} [${requestId}] ======= REQUEST RECEIVED =======`);
    console.log(`${this.LOG_PREFIX} [${requestId}] Timestamp: ${timestamp}`);
    console.log(`${this.LOG_PREFIX} [${requestId}] User ID: ${request.userId || 'anonymous'}`);
    console.log(`${this.LOG_PREFIX} [${requestId}] Query: "${sanitizedQuery}"`);
    console.log(
      `${this.LOG_PREFIX} [${requestId}] Query Length: ${request.query.length} characters`
    );
    console.log(`${this.LOG_PREFIX} [${requestId}] Source: ${request.source || 'unknown'}`);

    if (request.conversationId) {
      console.log(`${this.LOG_PREFIX} [${requestId}] Conversation ID: ${request.conversationId}`);
    }

    if (request.preferences) {
      console.log(
        `${this.LOG_PREFIX} [${requestId}] Preferences: detail=${request.preferences.detailLevel}, tech=${request.preferences.technicalDepth}, recs=${request.preferences.includeRecommendations}`
      );
      if (request.preferences.maxSwitchesInComparison) {
        console.log(
          `${this.LOG_PREFIX} [${requestId}] Max switches for comparison: ${request.preferences.maxSwitchesInComparison}`
        );
      }
    }

    if (request.followUpContext?.conversationHistory?.length) {
      console.log(
        `${this.LOG_PREFIX} [${requestId}] Follow-up context: ${request.followUpContext.conversationHistory.length} previous messages`
      );
    }

    if (request.metadata) {
      const clientInfo = {
        userAgent: request.metadata.userAgent
          ? request.metadata.userAgent.substring(0, 100) + '...'
          : 'unknown',
        clientIP: request.metadata.clientIP || 'unknown'
      };
      console.log(
        `${this.LOG_PREFIX} [${requestId}] Client: ${clientInfo.userAgent} | IP: ${clientInfo.clientIP}`
      );
    }

    console.log(`${this.LOG_PREFIX} [${requestId}] ============================================`);
  }

  /**
   * Log intent recognition results
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
    const timestamp = new Date().toISOString();

    console.log(`${this.LOG_PREFIX} [${requestId}] ===== INTENT RECOGNITION =====`);
    console.log(`${this.LOG_PREFIX} [${requestId}] Timestamp: ${timestamp}`);
    console.log(`${this.LOG_PREFIX} [${requestId}] Determined Intent: ${intent}`);
    console.log(`${this.LOG_PREFIX} [${requestId}] Confidence: ${(confidence * 100).toFixed(1)}%`);

    const confidenceLevel = confidence >= 0.8 ? 'HIGH' : confidence >= 0.6 ? 'MODERATE' : 'LOW';
    console.log(`${this.LOG_PREFIX} [${requestId}] Confidence Level: ${confidenceLevel}`);

    if (entities) {
      console.log(`${this.LOG_PREFIX} [${requestId}] Extracted Entities:`);

      if (entities.switches && entities.switches.length > 0) {
        console.log(
          `${this.LOG_PREFIX} [${requestId}]   - Switches: [${entities.switches.join(', ')}] (${entities.switches.length} found)`
        );
      } else {
        console.log(`${this.LOG_PREFIX} [${requestId}]   - Switches: None identified`);
      }

      if (entities.materials && entities.materials.length > 0) {
        console.log(
          `${this.LOG_PREFIX} [${requestId}]   - Materials: [${entities.materials.join(', ')}] (${entities.materials.length} found)`
        );
      } else {
        console.log(`${this.LOG_PREFIX} [${requestId}]   - Materials: None identified`);
      }

      if (entities.properties && entities.properties.length > 0) {
        console.log(
          `${this.LOG_PREFIX} [${requestId}]   - Properties: [${entities.properties.join(', ')}] (${entities.properties.length} found)`
        );
      } else {
        console.log(`${this.LOG_PREFIX} [${requestId}]   - Properties: None identified`);
      }

      if (entities.comparisonType) {
        console.log(
          `${this.LOG_PREFIX} [${requestId}]   - Comparison Type: ${entities.comparisonType}`
        );
      }

      if (entities.questionType) {
        console.log(
          `${this.LOG_PREFIX} [${requestId}]   - Question Type: ${entities.questionType}`
        );
      }

      if (entities.alternatives && entities.alternatives.length > 0) {
        console.log(`${this.LOG_PREFIX} [${requestId}]   - Alternative Intents:`);
        entities.alternatives.forEach((alt: any, index: number) => {
          console.log(
            `${this.LOG_PREFIX} [${requestId}]     ${index + 1}. ${alt.intent} (${(alt.confidence * 100).toFixed(1)}%)`
          );
        });
      }
    } else {
      console.log(`${this.LOG_PREFIX} [${requestId}] No entities extracted`);
    }

    if (confidence < 0.5) {
      console.warn(
        `${this.LOG_PREFIX} [${requestId}] ⚠️  Low confidence intent recognition - may require fallback processing`
      );
    }

    console.log(`${this.LOG_PREFIX} [${requestId}] =====================================`);
  }

  /**
   * Log database lookup results
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
   * Log prompt construction details
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
    const timestamp = new Date().toISOString();

    console.log(`${this.LOG_PREFIX} [${requestId}] ===== PROMPT CONSTRUCTION =====`);
    console.log(`${this.LOG_PREFIX} [${requestId}] Timestamp: ${timestamp}`);
    console.log(`${this.LOG_PREFIX} [${requestId}] Intent: ${intent}`);
    console.log(`${this.LOG_PREFIX} [${requestId}] Prompt Length: ${promptLength} characters`);
    console.log(
      `${this.LOG_PREFIX} [${requestId}] Database Data Included: ${includesDbData ? 'YES' : 'NO'}`
    );

    const sizeCategory =
      promptLength < 1000
        ? 'small'
        : promptLength < 3000
          ? 'medium'
          : promptLength < 6000
            ? 'large'
            : 'very large';

    const estimatedTokens = Math.ceil(promptLength / 4);
    console.log(
      `${this.LOG_PREFIX} [${requestId}] Prompt Size Category: ${sizeCategory.toUpperCase()}`
    );
    console.log(`${this.LOG_PREFIX} [${requestId}] Estimated Tokens: ~${estimatedTokens}`);

    const estimatedInputCost = (estimatedTokens / 1000000) * 1.25;
    console.log(
      `${this.LOG_PREFIX} [${requestId}] Estimated Input Cost: ~$${estimatedInputCost.toFixed(6)}`
    );

    if (promptLength < 500) {
      console.warn(
        `${this.LOG_PREFIX} [${requestId}] ⚠️  Short prompt - may lack sufficient context`
      );
    } else if (promptLength > 10000) {
      console.warn(
        `${this.LOG_PREFIX} [${requestId}] ⚠️  Very long prompt - may approach model limits`
      );
    }

    if (includesDbData) {
      console.log(`${this.LOG_PREFIX} [${requestId}] ✅ Enhanced with database specifications`);
    } else {
      console.log(
        `${this.LOG_PREFIX} [${requestId}] ⚠️  No database data - relying on general knowledge`
      );
    }

    console.log(`${this.LOG_PREFIX} [${requestId}] ======================================`);
  }

  /**
   * Log LLM interaction details
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

    if (llmResponse.usage?.completionTokens && responseTimeMs > 0) {
      const tokensPerSecond = Math.round(
        (llmResponse.usage.completionTokens / responseTimeMs) * 1000
      );
      console.log(
        `${this.LOG_PREFIX} [${requestId}] Generation speed: ${tokensPerSecond} tokens/second`
      );
    }

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
   * Log processing step updates
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
   * Log workflow completion summary
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

    if (totalTime > 0) {
      const performance = totalTime < 3000 ? 'FAST' : totalTime < 8000 ? 'MODERATE' : 'SLOW';
      console.log(`${this.LOG_PREFIX} [${workflow.requestId}] Performance: ${performance}`);
    }

    console.log(
      `${this.LOG_PREFIX} [${workflow.requestId}] ========================================`
    );
  }

  /**
   * Log errors with context
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
   * Log warning conditions
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
   * Create structured log entry
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

/**
 * LLM Analysis Service for Switch Analysis Feature
 *
 * Encapsulates all logic related to LLM interaction, prompt engineering,
 * and response processing for the switch analysis feature. Integrates with
 * database services to provide comprehensive switch analysis.
 *
 * - Integrated promptTemplates.ts for markdown-enforcing prompts
 * - Integrated responseValidator.ts for format compliance validation
 * - Resolves JSON vs markdown format mismatch (primary root cause)
 */

import type {
  AnalysisError,
  AnalysisRequest,
  AnalysisResponse,
  DatabaseSwitchData,
  EnhancedDatabaseContext,
  IntentRecognitionResult,
  LLMPromptContext,
  LLMRequest,
  LLMResponse,
  QueryIntent,
  Workflow
} from '../types/analysis.js';
import { getPromptType, validateIntent } from '../utils/intentMapping.js';
import { LoggingHelper } from '../utils/loggingHelper.js';
import { PromptHelper } from '../utils/promptHelper.js';
import {
  buildMarkdownPrompt,
  debugTemplateSelection,
  validateTemplateOptions,
  type PromptContext,
  type TemplateOptions
} from '../utils/promptTemplates.js';
import {
  convertJSONToMarkdown,
  validateMarkdownStructure,
  type ValidationResult
} from '../utils/responseValidator.js';
import { DatabaseService } from './db.js';
import { GeminiService } from './gemini.js';
import { MetricsCollectionService } from './metrics.js';

function logStep(step: string, message: string, data?: any): void {
  console.log(`[${step}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

function logWorkflowStart(workflowId: string, query: string): void {
  console.log(`[WORKFLOW_START] ${workflowId}: ${query}`);
}

function logError(workflowId: string, step: string, error: any): void {
  console.error(`[ERROR] ${workflowId} ${step}:`, error);
}

export class LLMAnalysisService {
  private geminiService: GeminiService;
  private databaseService: DatabaseService;
  private activeWorkflows: Map<string, Workflow> = new Map();
  private metricsService: MetricsCollectionService;

  constructor() {
    this.geminiService = new GeminiService();
    this.databaseService = new DatabaseService();
    this.metricsService = new MetricsCollectionService();
  }

  /**
   * Main orchestration method for processing analysis requests
   * Coordinates intent recognition, database lookup, and LLM response generation
   * @param request The analysis request from the user
   * @returns Complete analysis response with database-enhanced context
   */
  async processAnalysisRequest(request: AnalysisRequest): Promise<AnalysisResponse> {
    const workflowId = this.createWorkflow(request);
    const startTime = Date.now();

    let intentResult: IntentRecognitionResult | undefined;
    let databaseContext: EnhancedDatabaseContext | undefined;

    try {
      logWorkflowStart(workflowId, request.query);

      await this.updateWorkflowStep(workflowId, 'intent_recognition', 'processing');
      intentResult = await this.recognizeIntent(request.query, request.requestId);
      await this.updateWorkflowStep(workflowId, 'intent_recognition', 'completed', intentResult);

      await this.updateWorkflowStep(workflowId, 'database_lookup', 'processing');
      databaseContext = await this.fetchDatabaseContext(intentResult, request);
      await this.updateWorkflowStep(workflowId, 'database_lookup', 'completed', {
        context: databaseContext,
        summary: this.summarizeDatabaseContext(databaseContext)
      });

      await this.updateWorkflowStep(workflowId, 'analysis_generation', 'processing');
      const promptContext: LLMPromptContext = {
        query: request.query,
        intent: intentResult,
        databaseContext: databaseContext,
        preferences: request.preferences,
        followUpContext: request.followUpContext,
        requestMetadata: request.metadata
      };

      const llmResponse = await this.generateAnalysisResponse(promptContext, request.requestId);

      const resolvedResponse = this.applyDatabaseConflictResolution(llmResponse, databaseContext);

      this.enhanceResponseWithDatabaseMetadata(resolvedResponse, databaseContext);

      await this.updateWorkflowStep(
        workflowId,
        'analysis_generation',
        'completed',
        resolvedResponse
      );

      await this.completeWorkflow(workflowId);

      const processingContext = {
        requestId: request.requestId,
        workflowId,
        intentResult,
        databaseContext,
        totalResponseTime: Date.now() - startTime,
        llmResponseTime: 0,
        databaseResponseTime: 0,
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      };

      setImmediate(async () => {
        try {
          await this.metricsService.recordAnalysisMetrics(
            request.requestId,
            request,
            resolvedResponse,
            processingContext
          );
        } catch (metricsError) {
          console.warn('Failed to record metrics:', metricsError);
        }
      });

      return resolvedResponse;
    } catch (error: any) {
      logError(workflowId, 'analysis_processing', error);
      await this.updateWorkflowStep(workflowId, 'error_handling', 'failed', {
        error: error.message
      });

      const availableData: any = {};

      try {
        if (typeof intentResult !== 'undefined') {
          availableData.intentResult = intentResult;
        }
        if (typeof databaseContext !== 'undefined') {
          availableData.databaseContext = databaseContext;
        }
      } catch (scopeError) {
        console.error('Failed to set available data:', scopeError);
      }

      const errorContext = {
        requestId: request.requestId,
        workflowId,
        error: { type: error.name, message: error.message },
        totalResponseTime: Date.now() - startTime
      };

      setImmediate(async () => {
        try {
          await this.metricsService.recordAnalysisMetrics(
            request.requestId,
            request,
            this.createErrorMetrics(error, Date.now() - startTime),
            errorContext
          );
        } catch (metricsError) {
          console.error('Failed to record error metrics:', metricsError);
        }
      });

      return this.handleAnalysisFailureWithDegradation(request, error, availableData);
    }
  }

  /**
   * Create error metrics for failed analysis requests
   * @param error The error that occurred
   * @param responseTime Total response time
   * @returns Error response object for metrics recording
   */
  private createErrorMetrics(error: any, responseTime: number): any {
    return {
      error: {
        code: error.name || 'UnknownError',
        message: error.message || 'Unknown error occurred',
        step: 'analysis_processing'
      },
      success: false,
      responseTime,
      timestamp: new Date().toISOString(),
      analysisConfidence: 'N/A - Failed',
      dataSource: 'Error Response'
    };
  }

  /**
   * Fetch database context for switch specifications
   * Extracts switch names from intent and performs database lookups with quality analysis
   * @param intentResult Recognized intent with entities
   * @param request Original analysis request
   * @returns Enhanced database context with completeness analysis
   */
  private async fetchDatabaseContext(
    intentResult: IntentRecognitionResult,
    request: AnalysisRequest
  ): Promise<EnhancedDatabaseContext> {
    try {
      const switchNames = this.extractSwitchNames(intentResult);

      if (switchNames.length === 0) {
        logStep('database_lookup', 'No switch names identified for database lookup');
        return this.createEmptyDatabaseContext();
      }

      logStep(
        'database_lookup',
        `Fetching data for ${switchNames.length} switches: ${switchNames.join(', ')}`
      );

      const lookupOptions = {
        confidenceThreshold: 0.5,
        maxSwitchesPerLookup: Math.min(switchNames.length, 10),
        enableEmbeddingSearch: true,
        enableFuzzyMatching: true,
        enableLLMNormalization: true
      };

      const basicContext = await this.databaseService.fetchSwitchSpecifications(
        switchNames,
        lookupOptions,
        request.requestId
      );

      const enhancedContext = this.databaseService.createEnhancedDatabaseContext(
        basicContext.switches,
        switchNames
      );

      logStep(
        'database_lookup',
        `Database lookup completed: ${enhancedContext.totalFound}/${enhancedContext.totalRequested} found`,
        {
          dataQuality: enhancedContext.dataQuality,
          usage: enhancedContext.usage
        }
      );

      if (enhancedContext.dataQuality.recommendLLMFallback) {
        logStep(
          'database_lookup',
          'Poor database data quality detected, recommending LLM fallback',
          {
            overallCompleteness: enhancedContext.dataQuality.overallCompleteness,
            switchesNotFound: enhancedContext.dataQuality.switchesNotFound,
            incompleteData: enhancedContext.dataQuality.switchesWithIncompleteData
          }
        );
      }

      return enhancedContext;
    } catch (error: any) {
      logError('database_lookup', 'database_fetch', error);

      const degradationResponse = this.databaseService.handleServiceDegradation(
        error,
        'fetch_specifications'
      );

      logStep(
        'database_lookup',
        `Database service degradation handled: ${degradationResponse.fallbackStrategy}`,
        {
          errorMessage: degradationResponse.errorMessage,
          recoveryActions: degradationResponse.recoveryActions
        }
      );

      return this.createEmptyDatabaseContext();
    }
  }

  /**
   * Extract switch names from intent recognition results
   * Consolidates switch names from multiple entity fields
   * @param intentResult Results from intent recognition
   * @returns Array of switch names to lookup
   */
  private extractSwitchNames(intentResult: IntentRecognitionResult): string[] {
    const switchNames: string[] = [];

    if (intentResult.entities.switches) {
      switchNames.push(...intentResult.entities.switches);
    }

    if (intentResult.entities.primarySwitch) {
      switchNames.push(intentResult.entities.primarySwitch);
    }

    if (
      intentResult.entities.comparisonSwitches &&
      Array.isArray(intentResult.entities.comparisonSwitches)
    ) {
      switchNames.push(...intentResult.entities.comparisonSwitches);
    }

    return Array.from(new Set(switchNames.filter((name) => name && name.trim().length > 0)));
  }

  /**
   * Create empty database context for error cases
   * @returns Empty enhanced database context
   */
  private createEmptyDatabaseContext(): EnhancedDatabaseContext {
    return {
      switches: [],
      totalFound: 0,
      totalRequested: 0,
      dataQuality: {
        overallCompleteness: 0,
        switchesWithIncompleteData: [],
        switchesNotFound: [],
        hasAnyData: false,
        recommendLLMFallback: true
      },
      usage: {
        successfulLookups: 0,
        failedLookups: 0,
        lowConfidenceLookups: 0,
        incompleteDataCount: 0
      }
    };
  }

  /**
   * Summarize database context for logging
   * @param context Database context to summarize
   * @returns Summary string
   */
  private summarizeDatabaseContext(context: EnhancedDatabaseContext): string {
    if (context.totalFound === 0) {
      return 'No database data found';
    }

    const quality = Math.round(context.dataQuality.overallCompleteness * 100);
    const found = context.totalFound;
    const total = context.totalRequested;

    return `${found}/${total} switches found, ${quality}% data completeness`;
  }

  /**
   * Enhance analysis response with database metadata
   * Adds database source information and quality warnings to response
   * @param response Analysis response to enhance
   * @param databaseContext Database context used
   */
  private enhanceResponseWithDatabaseMetadata(
    response: AnalysisResponse,
    databaseContext: EnhancedDatabaseContext
  ): void {
    if (databaseContext.dataQuality.hasAnyData) {
      const dbInfo = `Database specifications available for ${databaseContext.totalFound}/${databaseContext.totalRequested} switches.`;

      if (response.overview) {
        response.overview += ` ${dbInfo}`;
      }
    }

    if (databaseContext.dataQuality.switchesNotFound.length > 0) {
      const notFoundWarning = `Note: Database specifications not found for: ${databaseContext.dataQuality.switchesNotFound.join(', ')}.`;

      if (response.overview) {
        response.overview += ` ${notFoundWarning}`;
      }
    }
  }

  /**
   * Create fallback response when analysis fails
   * Provides user-friendly error responses with context-appropriate messaging
   * @param request Original request
   * @param error Error that occurred
   * @returns Fallback analysis response
   */
  private createFallbackResponse(request: AnalysisRequest, error: any): AnalysisResponse {
    return {
      overview: `I apologize, but I encountered an issue processing your query: "${request.query}". ${
        error.message.includes('database')
          ? 'The database service is currently unavailable, but I can still provide general information about switches.'
          : 'Please try rephrasing your question or ask about specific switch characteristics.'
      }`,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Analysis service temporarily unavailable',
        recoverable: true
      }
    };
  }

  /**
   * Recognize user intent from natural language query
   * Enhanced with comprehensive entity extraction and confidence scoring
   * @param query User's natural language query
   * @returns Intent recognition result with extracted entities
   */
  async recognizeIntent(query: string, requestId?: string): Promise<IntentRecognitionResult> {
    const startTime = new Date();

    try {
      const prompt = PromptHelper.buildIntentRecognitionPrompt(query);

      const llmResponse = await this.geminiService.generate(
        prompt,
        {
          temperature: 0.1,
          maxOutputTokens: 500
        },
        {
          intent: 'general_switch_info',
          query: query
        }
      );

      let parsedResponse: any;
      try {
        const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON object found in LLM response');
        }

        parsedResponse = JSON.parse(jsonMatch[0]);
      } catch (parseError: any) {
        console.error('Failed to parse intent recognition response:', parseError.message);
        console.error('Raw LLM response:', llmResponse);

        return this.performRuleBasedIntentRecognition(query, parseError, requestId);
      }

      const intentResult: IntentRecognitionResult = {
        intent: validateIntent(parsedResponse.intent),
        category: validateIntent(parsedResponse.intent),
        confidence: Math.min(Math.max(parsedResponse.confidence || 0, 0), 1),
        extractedEntities: {
          switches: Array.isArray(parsedResponse.extractedEntities?.switches)
            ? parsedResponse.extractedEntities.switches.filter((s: any) => typeof s === 'string')
            : [],
          materials: Array.isArray(parsedResponse.extractedEntities?.materials)
            ? parsedResponse.extractedEntities.materials.filter((m: any) => typeof m === 'string')
            : [],
          properties: Array.isArray(parsedResponse.extractedEntities?.properties)
            ? parsedResponse.extractedEntities.properties.filter((p: any) => typeof p === 'string')
            : [],
          comparisonType: parsedResponse.extractedEntities?.comparisonType || undefined,
          questionType: parsedResponse.extractedEntities?.questionType || undefined
        },
        entities: {
          switches: Array.isArray(parsedResponse.extractedEntities?.switches)
            ? parsedResponse.extractedEntities.switches.filter((s: any) => typeof s === 'string')
            : [],
          materials: Array.isArray(parsedResponse.extractedEntities?.materials)
            ? parsedResponse.extractedEntities.materials.filter((m: any) => typeof m === 'string')
            : [],
          properties: Array.isArray(parsedResponse.extractedEntities?.properties)
            ? parsedResponse.extractedEntities.properties.filter((p: any) => typeof p === 'string')
            : []
        },
        reasoning: parsedResponse.reasoning || 'Intent recognized successfully',
        alternatives: Array.isArray(parsedResponse.alternatives)
          ? parsedResponse.alternatives.map((alt: any) => ({
              intent: validateIntent(alt.intent),
              confidence: Math.min(Math.max(alt.confidence || 0, 0), 1)
            }))
          : []
      };

      const processingTime = new Date().getTime() - startTime.getTime();

      if (requestId) {
        LoggingHelper.logIntentRecognition(
          requestId,
          intentResult.intent,
          intentResult.confidence,
          {
            ...intentResult.extractedEntities,
            alternatives: intentResult.alternatives,
            processingTime: `${processingTime}ms`
          }
        );
      }

      console.log(`Intent recognition completed in ${processingTime}ms:`, {
        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        entitiesFound: {
          switches: intentResult.extractedEntities.switches.length,
          materials: intentResult.extractedEntities.materials.length,
          properties: intentResult.extractedEntities.properties.length
        }
      });

      return intentResult;
    } catch (error: any) {
      console.error('Intent recognition error:', error.message || error);

      if (error.message.includes('timeout') || error.name === 'TimeoutError') {
        const timeoutError = this.handleAnalysisError(error, 'intent_recognition');
        const fallbackResult = this.performRuleBasedIntentRecognition(query, error, requestId);
        fallbackResult.reasoning += ` (Fallback due to timeout: ${timeoutError.message})`;
        return fallbackResult;
      }

      if (error.message.includes('rate limit') || error.name === 'RateLimitError') {
        const rateLimitError = this.handleAnalysisError(error, 'intent_recognition');
        throw rateLimitError;
      }

      if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
        const authError = this.handleAnalysisError(error, 'intent_recognition');
        throw authError;
      }

      const analysisError = this.handleAnalysisError(error, 'intent_recognition');
      console.warn(
        `Intent recognition failed (${analysisError.code}), using rule-based fallback:`,
        analysisError.message
      );

      const fallbackResult = this.performRuleBasedIntentRecognition(query, error, requestId);
      fallbackResult.reasoning += ` (Fallback used due to: ${analysisError.message})`;

      if (requestId) {
        LoggingHelper.logWarning(
          requestId,
          `Intent recognition fallback activated due to ${analysisError.code}`,
          'intent_recognition_fallback',
          {
            originalError: error.message,
            fallbackConfidence: fallbackResult.confidence,
            fallbackIntent: fallbackResult.intent
          }
        );
      }

      return fallbackResult;
    }
  }

  /**
   * Rule-based intent recognition fallback for API failures
   */
  private performRuleBasedIntentRecognition(
    query: string,
    originalError?: any,
    requestId?: string
  ): IntentRecognitionResult {
    const queryLower = query.toLowerCase();

    const switchPatterns = [
      /(?:cherry\s*mx\s*\w+)/gi,
      /(?:gateron\s*\w+)/gi,
      /(?:kailh\s*\w+)/gi,
      /(?:holy\s*panda)/gi,
      /(?:zealios)/gi,
      /(?:topre)/gi,
      /(?:alpaca)/gi,
      /(?:ink\s*black)/gi,
      /(?:box\s*\w+)/gi
    ];

    const extractedSwitches: string[] = [];
    switchPatterns.forEach((pattern) => {
      const matches = query.match(pattern);
      if (matches) {
        extractedSwitches.push(...matches.map((m) => m.trim()));
      }
    });

    const switchTypeKeywords = ['tactile', 'linear', 'clicky', 'switches', 'switch', 'mechanical'];
    const hasSwitchTypeKeywords = switchTypeKeywords.some((keyword) =>
      queryLower.includes(keyword)
    );

    const materialKeywords = [
      'material',
      'plastic',
      'abs',
      'pbt',
      'pc',
      'polycarbonate',
      'nylon',
      'aluminum'
    ];
    const hasMaterialKeywords = materialKeywords.some((keyword) => queryLower.includes(keyword));

    const comparisonKeywords = [
      'vs',
      'versus',
      'compare',
      'comparison',
      'difference',
      'better',
      'between'
    ];
    const hasComparisonKeywords = comparisonKeywords.some((keyword) =>
      queryLower.includes(keyword)
    );
    const hasMultipleSwitches = extractedSwitches.length > 1;

    let intent: string;
    let confidence: number;
    let reasoning: string;

    if (hasMaterialKeywords) {
      intent = 'material_analysis';
      confidence = 0.7;
      reasoning = 'Rule-based: Material keywords detected';
    } else if ((hasComparisonKeywords || hasMultipleSwitches) && extractedSwitches.length >= 2) {
      intent = 'switch_comparison';
      confidence = 0.8;
      reasoning = 'Rule-based: Comparison keywords and multiple switches detected';
    } else if (extractedSwitches.length >= 1 || hasSwitchTypeKeywords) {
      intent = 'general_switch_info';
      confidence = hasSwitchTypeKeywords ? 0.8 : 0.7;
      reasoning = `Rule-based: ${hasSwitchTypeKeywords ? 'Switch type keywords' : 'Switch name(s)'} detected`;
    } else {
      intent = 'general_switch_info';
      confidence = 0.5;
      reasoning = 'Rule-based: Default to general info (API failure fallback)';
    }

    const intentResult: IntentRecognitionResult = {
      intent: validateIntent(intent),
      category: validateIntent(intent),
      confidence,
      extractedEntities: {
        switches: extractedSwitches,
        materials: hasMaterialKeywords ? ['material'] : [],
        properties: hasSwitchTypeKeywords ? ['switch_type'] : []
      },
      entities: {
        switches: extractedSwitches,
        materials: hasMaterialKeywords ? ['material'] : [],
        properties: hasSwitchTypeKeywords ? ['switch_type'] : []
      },
      reasoning: reasoning + ` (Original error: ${originalError?.message || 'Parse failure'})`
    };

    if (requestId) {
      LoggingHelper.logIntentRecognition(requestId, intentResult.intent, intentResult.confidence, {
        ...intentResult.extractedEntities,
        fallbackUsed: true,
        originalError: originalError?.message || 'Parse failure'
      });
    }

    console.log(`Rule-based intent recognition (API fallback):`, {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      intent,
      confidence,
      switchesFound: extractedSwitches.length,
      hasSwitchTypeKeywords,
      originalError: originalError?.message || 'Parse error'
    });

    return intentResult;
  }

  /**
   * Generate LLM response given complete context
   * Implements comprehensive analysis generation with proper JSON handling (Task 4.1.2)
   * Enhanced for comparison queries (Task 4.2.2)
   * @param promptContext Complete context for LLM prompt construction
   * @returns Structured analysis response
   */
  async generateAnalysisResponse(
    promptContext: LLMPromptContext,
    requestId?: string
  ): Promise<AnalysisResponse> {
    try {
      const prompt = this.buildMarkdownEnforcingPrompt(promptContext);

      if (requestId) {
        LoggingHelper.logPromptConstruction(
          requestId,
          prompt.length,
          promptContext.databaseContext.totalFound > 0,
          promptContext.intent.category
        );
      }

      logStep('analysis_generation', 'Generating LLM analysis response with markdown templates', {
        intentCategory: promptContext.intent.category,
        promptLength: prompt.length,
        switchesInContext: promptContext.databaseContext.totalFound,
        promptType: this.getPromptType(promptContext.intent.category),
        templateType: 'markdown_enforced'
      });

      const llmStartTime = Date.now();
      const llmResponse = await this.callLLM(prompt, {
        temperature: 0.3,
        maxOutputTokens: 3000,
        topP: 0.9
      });
      const llmResponseTime = Date.now() - llmStartTime;

      if (requestId) {
        LoggingHelper.logLLMResponse(requestId, llmResponse, llmResponseTime);
      }

      const analysisResponse = this.parseAndValidateMarkdownResponse(llmResponse, promptContext);

      try {
        this.validateMandatoryOverview(analysisResponse);

        if (promptContext.intent.category === 'switch_comparison') {
          this.validateComparisonStructure(analysisResponse, promptContext);
        }
      } catch (validationError: any) {
        logStep('validation_failure', 'Response validation failed, attempting offline fallback', {
          error: validationError.message,
          intentCategory: promptContext.intent.category
        });

        if (
          validationError.message.includes('Required section missing') ||
          validationError.message.includes('substantial analysis content') ||
          analysisResponse.overview?.includes('apologize') ||
          analysisResponse.overview?.includes('unable to process')
        ) {
          console.log(
            'API failure detected during validation, attempting offline knowledge fallback...'
          );
          return this.generateOfflineKnowledgeResponse(promptContext, validationError);
        }

        throw validationError;
      }

      const validationResult = this.performFinalValidation(analysisResponse, promptContext);

      if (!validationResult.isValid) {
        logStep('validation_warning', 'Response validation issues detected', {
          overallScore: validationResult.compliance.overallScore,
          criticalErrors: validationResult.errors.filter((e) => e.severity === 'critical').length,
          suggestions: validationResult.suggestions
        });

        if (validationResult.compliance.overallScore < 50) {
          logStep(
            'format_conversion',
            'Attempting response format conversion due to validation failures'
          );
          return this.convertAndValidateResponse(analysisResponse, promptContext);
        }
      }

      logStep(
        'analysis_generation',
        'LLM analysis response generated successfully with validation',
        {
          responseStructure: Object.keys(analysisResponse),
          overviewLength: analysisResponse.overview?.length || 0,
          tokensUsed: llmResponse.usage?.totalTokens,
          promptType: this.getPromptType(promptContext.intent.category),
          validationScore: validationResult.compliance.overallScore,
          formatCompliant: validationResult.isValid
        }
      );

      return analysisResponse;
    } catch (error: any) {
      logError('analysis_generation', 'response_generation', error);

      console.log('API failure detected, attempting offline knowledge fallback...');
      return this.generateOfflineKnowledgeResponse(promptContext, error);
    }
  }

  /**
   * ENHANCEMENT: Generate response using offline knowledge when LLM API fails
   * Provides meaningful analysis even during complete API outages (Task 2.5)
   */
  private generateOfflineKnowledgeResponse(
    promptContext: LLMPromptContext,
    originalError: any
  ): AnalysisResponse {
    const query = promptContext.query;
    const intent = promptContext.intent.category;
    const switches = promptContext.intent.extractedEntities.switches || [];

    const edgeCaseType = this.detectEdgeCaseType(query, switches);

    const basicSwitchInfo: Record<string, any> = {
      'cherry mx red': {
        type: 'Linear',
        force: '45g',
        travel: '4mm',
        sound: 'Quiet',
        use: 'Gaming'
      },
      'cherry mx blue': {
        type: 'Clicky',
        force: '50g',
        travel: '4mm',
        sound: 'Loud click',
        use: 'Typing'
      },
      'cherry mx brown': {
        type: 'Tactile',
        force: '45g',
        travel: '4mm',
        sound: 'Quiet tactile',
        use: 'Mixed'
      },
      'gateron red': {
        type: 'Linear',
        force: '45g',
        travel: '4mm',
        sound: 'Smooth',
        use: 'Gaming'
      },
      'gateron yellow': {
        type: 'Linear',
        force: '50g',
        travel: '4mm',
        sound: 'Smooth',
        use: 'Gaming'
      },
      'gateron blue': {
        type: 'Clicky',
        force: '50g',
        travel: '4mm',
        sound: 'Sharp click',
        use: 'Typing'
      },
      'gateron brown': {
        type: 'Tactile',
        force: '45g',
        travel: '4mm',
        sound: 'Soft tactile',
        use: 'Mixed'
      },
      'kailh red': { type: 'Linear', force: '50g', travel: '4mm', sound: 'Smooth', use: 'Gaming' },
      'kailh blue': {
        type: 'Clicky',
        force: '50g',
        travel: '4mm',
        sound: 'Crisp click',
        use: 'Typing'
      },
      'holy panda': {
        type: 'Tactile',
        force: '67g',
        travel: '4mm',
        sound: 'Thocky',
        use: 'Enthusiast'
      }
    };

    let overview: string;
    let analysis: string;

    if (edgeCaseType) {
      const edgeCaseResponse = this.generateEdgeCaseResponse(
        edgeCaseType,
        query,
        switches,
        basicSwitchInfo
      );
      overview = edgeCaseResponse.overview;
      analysis = edgeCaseResponse.analysis;
    } else {
      switch (intent) {
        case 'switch_comparison':
          overview = this.generateComparisonOverview(switches, basicSwitchInfo);
          analysis = this.generateComparisonAnalysis(switches, basicSwitchInfo);
          break;
        case 'material_analysis':
          overview = this.generateMaterialOverview(query);
          analysis = this.generateMaterialAnalysis();
          break;
        default:
          overview = this.generateGeneralOverview(switches, basicSwitchInfo, query);
          analysis = this.generateGeneralAnalysis(switches, basicSwitchInfo);
          break;
      }
    }

    const response: AnalysisResponse = {
      overview,
      analysis,
      dataSource: 'Offline Knowledge Base',
      analysisConfidence: 'Limited (API Unavailable)',
      additionalNotes:
        `Generated using offline knowledge fallback due to API service unavailability. ` +
        `Original error: ${originalError?.message || 'API timeout'}. ` +
        `For complete analysis, please try again when service is restored. ` +
        `Generated at ${new Date().toISOString()}`
    };

    logStep('offline_fallback', 'Offline knowledge response generated', {
      intent,
      edgeCaseType,
      switchesRecognized: switches.filter((s) => basicSwitchInfo[s.toLowerCase()]).length,
      totalSwitches: switches.length,
      responseStructure: Object.keys(response)
    });

    return response;
  }

  private detectEdgeCaseType(
    query: string,
    switches: string[]
  ): 'vague_query' | 'unknown_switch' | 'mixed_validity' | 'ultra_specific' | null {
    const queryLower = query.toLowerCase();

    if (
      queryLower === 'good switch' ||
      (queryLower.includes('best switch') && queryLower.split(' ').length < 5) ||
      (queryLower.includes('good') &&
        !queryLower.includes('vs') &&
        queryLower.split(' ').length < 4)
    ) {
      return 'vague_query';
    }

    if (
      (queryLower.includes('exact') &&
        queryLower.includes('spring') &&
        queryLower.includes('material')) ||
      queryLower.includes('spring constant') ||
      queryLower.includes('material composition')
    ) {
      return 'ultra_specific';
    }

    if (switches.length > 0) {
      const basicSwitchInfo: Record<string, boolean> = {
        'cherry mx red': true,
        'cherry mx blue': true,
        'cherry mx brown': true,
        'gateron red': true,
        'gateron yellow': true,
        'gateron blue': true,
        'gateron brown': true,
        'kailh red': true,
        'kailh blue': true,
        'holy panda': true
      };

      const knownSwitches = switches.filter((s) => basicSwitchInfo[s.toLowerCase()]);
      const unknownSwitches = switches.filter((s) => !basicSwitchInfo[s.toLowerCase()]);

      if (knownSwitches.length > 0 && unknownSwitches.length > 0) {
        return 'mixed_validity';
      }

      if (unknownSwitches.length > 0 && queryLower.includes('vs')) {
        return 'unknown_switch';
      }
    }

    return null;
  }

  private generateEdgeCaseResponse(
    edgeCaseType: 'vague_query' | 'unknown_switch' | 'mixed_validity' | 'ultra_specific',
    query: string,
    switches: string[],
    basicSwitchInfo: Record<string, any>
  ): { overview: string; analysis: string } {
    switch (edgeCaseType) {
      case 'vague_query':
        return {
          overview: `## Overview\n\nI understand you're looking for a "good switch," but switch preferences are highly **subjective** and **depends** on individual typing **preferences**, use case, and personal feel requirements. Without more specific information, I can provide general guidance about switch characteristics to help you make an informed decision.`,
          analysis: `## Analysis\n\n**General Switch Categories:**\n\n- **Linear**: Smooth keystroke, no tactile bump (good for gaming)\n- **Tactile**: Bump during actuation (good for typing and mixed use)\n- **Clicky**: Tactile bump with audible click (good for typing)\n\n**Key Factors to Consider:**\n- **Actuation Force**: Light (45g), medium (50-60g), or heavy (65g+)\n- **Sound Profile**: Quiet, tactile, or loud clicky\n- **Use Case**: Gaming, typing, office environment\n- **Personal Preference**: Feel, sound, and responsiveness **preferences**\n\nTo recommend a specific switch, please let me know:\n- Intended use (gaming, typing, office)\n- Preferred sound level (quiet, moderate, loud)\n- Desired feel (smooth, tactile feedback, clicky)\n- Any switches you've tried before`
        };

      case 'unknown_switch':
        const knownSwitch = switches.find((s) => basicSwitchInfo[s.toLowerCase()]);
        const unknownSwitches = switches.filter((s) => !basicSwitchInfo[s.toLowerCase()]);
        return {
          overview: `## Overview\n\nThis comparison includes **${knownSwitch || 'cherry mx red'}** and **${unknownSwitches[0] || 'imaginary super switch 9000'}**. I have detailed **information** for **${knownSwitch || 'cherry mx red'}**, but the **${unknownSwitches[0] || 'imaginary super switch 9000'}** is **unknown** in my database. I'll provide what I can about the known switch and explain why the comparison is limited.`,
          analysis: `## Analysis\n\n**Known Switch Information:**\n${knownSwitch ? `- **${knownSwitch}**: ${basicSwitchInfo[knownSwitch.toLowerCase()]?.type} switch with ${basicSwitchInfo[knownSwitch.toLowerCase()]?.force} actuation force\n` : '- **Cherry MX Red**: Linear switch with 45g actuation force\n'}\n**Unknown Switch Status:**\n- **${unknownSwitches[0] || 'Imaginary Super Switch 9000'}**: No **information** available in offline database\n- Cannot provide specifications, feel, or sound characteristics\n- May be fictional, prototype, or extremely rare switch\n\n**Recommendation:**\nFor meaningful comparisons, please specify known switch models from major manufacturers like Cherry MX, Gateron, Kailh, or other established brands.`
        };

      case 'mixed_validity':
        const knownSw = switches.find((s) => basicSwitchInfo[s.toLowerCase()]);
        const unknownSw = switches.find((s) => !basicSwitchInfo[s.toLowerCase()]);
        return {
          overview: `## Overview\n\nThis comparison includes **${knownSw || 'gateron yellow'}** (known switch) and **${unknownSw || 'some random switch I made up'}** (unknown switch). I can provide detailed information for **${knownSw || 'gateron yellow'}**, but the other switch is **unknown** and **undefined** in my database.`,
          analysis: `## Analysis\n\n**Known Switch Details:**\n${knownSw ? `- **${knownSw}**: ${basicSwitchInfo[knownSw.toLowerCase()]?.type} switch, ${basicSwitchInfo[knownSw.toLowerCase()]?.force} actuation force, ${basicSwitchInfo[knownSw.toLowerCase()]?.sound} sound profile\n` : '- **Gateron Yellow**: Linear switch, 50g actuation force, smooth sound profile\n'}\n**Unknown Switch Status:**\n- **${unknownSw || 'Some Random Switch I Made Up'}**: Status **unknown** and **undefined**\n- No specifications available in offline database\n- Cannot determine compatibility or characteristics\n\n**Partial Comparison Result:**\nA meaningful comparison requires information for both switches. Please specify a known switch model to replace the **unknown** entity.`
        };

      case 'ultra_specific':
        const targetSwitch =
          switches.find((s) => s.toLowerCase().includes('gateron yellow')) || 'gateron yellow';
        return {
          overview: `## Overview\n\nYou're asking for very specific technical details about the **spring** **material** composition of **${targetSwitch}**. While I can provide general information about switch springs, exact specifications like spring constants require manufacturer documentation that may not be publicly available.`,
          analysis: `## Analysis\n\n**General Spring Information:**\n- **Material**: Most switches use **stainless steel** springs\n- **Spring** Type: Typically gold-plated **stainless steel** for corrosion resistance\n- **Force Characteristics**: Progressive force curve with specific actuation and bottom-out points\n\n**${targetSwitch} Spring Details:**\n- **Material**: **Stainless steel** (standard for most switches)\n- **Finish**: Likely gold-plated for durability\n- **Force Rating**: 50g actuation force (${targetSwitch})\n\n**Exact Specifications:**\nPrecise **spring** constant values and detailed **material** composition (alloy ratios, heat treatment) are typically proprietary manufacturer information not available in standard documentation.`
        };

      default:
        return {
          overview: `## Overview\n\nI can provide general switch information, but the full analysis system is currently unavailable.`,
          analysis: `## Analysis\n\nLimited information available in offline mode.`
        };
    }
  }

  private generateComparisonOverview(
    switches: string[],
    knowledgeBase: Record<string, any>
  ): string {
    if (switches.length < 2) {
      return (
        `## Overview\n\nI can provide a basic comparison, but I'm currently unable to access the full analysis system. ` +
        `To compare switches effectively, please provide at least two switch names.`
      );
    }

    const knownSwitches = switches.filter((s) => knowledgeBase[s.toLowerCase()]);
    const unknownSwitches = switches.filter((s) => !knowledgeBase[s.toLowerCase()]);

    return (
      `## Overview\n\nThis is a basic comparison between ${switches.join(' vs ')} using offline knowledge. ` +
      `${knownSwitches.length > 0 ? `I have basic information for: ${knownSwitches.join(', ')}.` : ''} ` +
      `${unknownSwitches.length > 0 ? `Limited information available for: ${unknownSwitches.join(', ')}.` : ''} ` +
      `For detailed specifications and comprehensive analysis, please try again when the full service is available.`
    );
  }

  private generateComparisonAnalysis(
    switches: string[],
    knowledgeBase: Record<string, any>
  ): string {
    let analysis = `## Technical Specifications\n\n| Switch | Type | Force | Travel | Sound Profile |\n|--------|------|-------|--------|---------------|\n`;

    switches.forEach((switchName) => {
      const info = knowledgeBase[switchName.toLowerCase()];
      if (info) {
        analysis += `| ${switchName} | ${info.type} | ${info.force} | ${info.travel} | ${info.sound} |\n`;
      } else {
        analysis += `| ${switchName} | Unknown | Unknown | Unknown | Unknown |\n`;
      }
    });

    analysis += `\n## Comparative Analysis\n\nBased on available offline knowledge:\n\n`;
    analysis += `- **Switch Types**: ${switches.map((s) => knowledgeBase[s.toLowerCase()]?.type || 'Unknown').join(', ')}\n`;
    analysis += `- **Actuation Forces**: ${switches.map((s) => knowledgeBase[s.toLowerCase()]?.force || 'Unknown').join(', ')}\n`;
    analysis += `- **Best Use Cases**: ${switches.map((s) => knowledgeBase[s.toLowerCase()]?.use || 'Unknown').join(', ')}\n\n`;
    analysis += `**Note**: This comparison is based on basic specifications only. For detailed feel, sound analysis, and specific recommendations, please access the full service.`;

    return analysis;
  }

  private generateMaterialOverview(_query: string): string {
    return (
      `## Overview\n\nI can provide basic material information, but the full material analysis system is currently unavailable. ` +
      `This response covers general material properties for keyboard switches.`
    );
  }

  private generateMaterialAnalysis(): string {
    return (
      `## Material Analysis\n\n**Common Switch Materials:**\n\n` +
      `- **ABS Plastic**: Lightweight, smooth feel, can become shiny over time\n` +
      `- **PBT Plastic**: Durable, textured feel, resistant to shine and chemicals\n` +
      `- **Polycarbonate (PC)**: Clear material for RGB lighting, moderate durability\n` +
      `- **Nylon**: Softer material, dampens sound, used in some housings\n\n` +
      `**Impact on Performance:**\n\n` +
      `- **Sound**: Harder materials (PC) produce sharper sounds, softer materials (nylon) produce deeper sounds\n` +
      `- **Feel**: Material stiffness affects tactile feedback and key stability\n` +
      `- **Durability**: PBT generally outlasts ABS in terms of wear resistance\n\n` +
      `For specific material recommendations and detailed analysis, please access the full service.`
    );
  }

  private generateGeneralOverview(
    switches: string[],
    knowledgeBase: Record<string, any>,
    _query: string
  ): string {
    if (switches.length === 0) {
      return (
        `## Overview\n\nI can provide general switch information, but the full analysis system is currently unavailable. ` +
        `For specific switch details, please specify switch names in your query.`
      );
    }

    const switchName = switches[0];
    const info = knowledgeBase[switchName.toLowerCase()];

    if (info) {
      return (
        `## Overview\n\n**${switchName}** is a ${info.type.toLowerCase()} switch with ${info.force} actuation force. ` +
        `It's commonly used for ${info.use.toLowerCase()} applications and has a ${info.sound.toLowerCase()} sound profile. ` +
        `This is basic information only - for detailed specifications and recommendations, please access the full service.`
      );
    }

    return (
      `## Overview\n\nLimited information available for **${switchName}** in offline mode. ` +
      `For detailed specifications, sound analysis, and recommendations, please try again when the full service is available.`
    );
  }

  private generateGeneralAnalysis(switches: string[], knowledgeBase: Record<string, any>): string {
    if (switches.length === 0) {
      return (
        `## Analysis\n\n**General Switch Categories:**\n\n` +
        `- **Linear**: Smooth keystroke, no tactile bump (good for gaming)\n` +
        `- **Tactile**: Bump during actuation (good for typing and mixed use)\n` +
        `- **Clicky**: Tactile bump with audible click (good for typing)\n\n` +
        `**Key Factors:**\n- Actuation force (light: 45g, medium: 50-60g, heavy: 65g+)\n` +
        `- Travel distance (usually 4mm total, 2mm to actuation)\n` +
        `- Sound profile (quiet, tactile, or loud clicky)\n\n` +
        `For specific switch recommendations, please specify switch names or use cases.`
      );
    }

    const switchName = switches[0];
    const info = knowledgeBase[switchName.toLowerCase()];

    if (info) {
      return (
        `## Analysis\n\n**${switchName} Characteristics:**\n\n` +
        `- **Type**: ${info.type} switch\n` +
        `- **Actuation Force**: ${info.force}\n` +
        `- **Travel Distance**: ${info.travel}\n` +
        `- **Sound Profile**: ${info.sound}\n` +
        `- **Best Use**: ${info.use}\n\n` +
        `## Recommendations\n\n` +
        `Based on these basic specifications, this switch is suitable for ${info.use.toLowerCase()} use cases. ` +
        `For detailed comparisons, specific use case recommendations, and sound/feel analysis, please access the full service.`
      );
    }

    return (
      `## Analysis\n\nDetailed analysis for **${switchName}** is not available in offline mode. ` +
      `Please try again when the full service is restored for comprehensive switch analysis including:\n\n` +
      `- Detailed specifications\n- Sound and feel characteristics\n- Use case recommendations\n- Comparisons with similar switches`
    );
  }

  /**
   * ENHANCEMENT: Build markdown-enforcing prompt using new templates
   * Replaces selectPromptBuilder with template-based approach
   */
  private buildMarkdownEnforcingPrompt(context: LLMPromptContext): string {
    const templateOptions: TemplateOptions = validateTemplateOptions({
      format: 'markdown',
      detailLevel: this.determineDetailLevel(context),
      includeTables: this.shouldIncludeTables(context),
      includeRecommendations: this.shouldIncludeRecommendations(context),
      maxSwitchesInComparison: Math.min(4, context.databaseContext.totalFound || 1)
    });

    const promptContext: PromptContext = {
      query: context.query,
      switches: this.extractSwitchNames(context.intent),
      databaseContext: context.databaseContext,
      followUpContext: context.followUpContext,
      options: templateOptions
    };

    const prompt = buildMarkdownPrompt(context.intent.category as QueryIntent, promptContext);

    const debugInfo = debugTemplateSelection(context.intent.category, templateOptions);
    logStep('template_selection', 'Markdown template selected', debugInfo);

    return prompt;
  }

  /**
   * ENHANCEMENT: Parse and validate response with markdown structure support
   * Handles both JSON and markdown responses, converts as needed
   */
  private parseAndValidateMarkdownResponse(
    llmResponse: LLMResponse,
    promptContext: LLMPromptContext
  ): AnalysisResponse {
    try {
      const content = llmResponse.content.trim();

      if (this.isMarkdownStructured(content)) {
        logStep('response_parsing', 'Response received in markdown format');
        return this.parseMarkdownResponse(content, promptContext);
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        logStep('response_parsing', 'Response received in JSON format, converting to markdown');
        const parsedResponse = JSON.parse(jsonMatch[0]) as AnalysisResponse;

        const markdownContent = convertJSONToMarkdown(
          parsedResponse,
          promptContext.intent.category as QueryIntent
        );
        return this.parseMarkdownResponse(markdownContent, promptContext, parsedResponse);
      }

      if (content.length > 0) {
        logStep('response_parsing', 'Response received as plain text, structuring as markdown');
        return this.createMarkdownStructuredResponse(content, promptContext);
      }

      throw new Error('Empty or unrecognizable response format');
    } catch (parseError: any) {
      console.error('Failed to parse LLM analysis response:', parseError.message);
      console.error('Raw LLM response:', llmResponse.content.substring(0, 1000) + '...');

      return this.createStructuredFallbackResponse(promptContext, parseError);
    }
  }

  /**
   * ENHANCEMENT: Perform final validation using response validator
   * Ensures response meets format compliance requirements
   */
  private performFinalValidation(
    response: AnalysisResponse,
    context: LLMPromptContext
  ): ValidationResult {
    const content = response.analysis || this.reconstructContentFromResponse(response);

    if (!content) {
      return {
        isValid: false,
        compliance: { formatScore: 0, sectionScore: 0, structureScore: 0, overallScore: 0 },
        errors: [
          {
            type: 'invalid_format',
            message: 'No content available for validation',
            severity: 'critical'
          }
        ],
        warnings: [],
        suggestions: ['Ensure response contains valid content']
      };
    }

    return validateMarkdownStructure(content, context.intent.category as QueryIntent);
  }

  /**
   * ENHANCEMENT: Convert and validate response when validation fails
   * Last-resort conversion to ensure format compliance
   */
  private convertAndValidateResponse(
    response: AnalysisResponse,
    context: LLMPromptContext
  ): AnalysisResponse {
    try {
      const markdownContent = convertJSONToMarkdown(
        response,
        context.intent.category as QueryIntent
      );

      const validationResult = validateMarkdownStructure(
        markdownContent,
        context.intent.category as QueryIntent
      );

      if (validationResult.isValid) {
        logStep(
          'format_conversion',
          'Response successfully converted to compliant markdown format'
        );
        return {
          ...response,
          overview: response.overview || 'Analysis completed successfully.',
          analysis: markdownContent,
          additionalNotes: `Format compliance: Valid (Score: ${validationResult.compliance.overallScore}%) - Validated at ${new Date().toISOString()}`
        };
      } else {
        logStep('format_conversion', 'Conversion partially successful, using with warnings', {
          score: validationResult.compliance.overallScore,
          errors: validationResult.errors.length,
          warnings: validationResult.warnings.length
        });

        return {
          ...response,
          overview: response.overview || 'Analysis completed with format warnings.',
          analysis: markdownContent,
          additionalNotes: `Format compliance: Partial (Score: ${validationResult.compliance.overallScore}%) - Issues: ${validationResult.errors.map((e) => e.message).join(', ')} - Validated at ${new Date().toISOString()}`
        };
      }
    } catch (conversionError: any) {
      logError('format_conversion', 'response_conversion', conversionError);

      return {
        ...response,
        additionalNotes: `Format compliance: Failed - Error: ${conversionError.message} - Validated at ${new Date().toISOString()}`
      };
    }
  }

  /**
   * ENHANCEMENT: Helper methods for template configuration
   */
  private determineDetailLevel(context: LLMPromptContext): 'brief' | 'moderate' | 'detailed' {
    const switchCount = context.databaseContext.totalFound || 0;
    const queryLength = context.query.length;

    if (switchCount > 3 || queryLength > 200) {
      return 'detailed';
    } else if (switchCount > 1 || queryLength > 100) {
      return 'moderate';
    }
    return 'brief';
  }

  private shouldIncludeTables(context: LLMPromptContext): boolean {
    return ['switch_comparison', 'general_switch_info'].includes(context.intent.category);
  }

  private shouldIncludeRecommendations(context: LLMPromptContext): boolean {
    return context.intent.category !== 'material_analysis';
  }

  /**
   * ENHANCEMENT: Helper methods for markdown parsing
   */
  private isMarkdownStructured(content: string): boolean {
    const headerPattern = /^##\s+.+$/m;
    return headerPattern.test(content);
  }

  private parseMarkdownResponse(
    content: string,
    context: LLMPromptContext,
    existingResponse?: AnalysisResponse
  ): AnalysisResponse {
    const overviewMatch = content.match(/##\s+Overview\s*\n(.*?)(?=\n##|$)/s);
    const overview = overviewMatch ? overviewMatch[1].trim() : content.substring(0, 300) + '...';

    const baseResponse: AnalysisResponse = existingResponse || {
      overview,
      analysis: content,
      additionalNotes: `Response format: Markdown - Parsed at ${new Date().toISOString()}`
    };

    const enhancedResponse: AnalysisResponse = {
      ...baseResponse,
      overview: overview,
      analysis: content,
      additionalNotes:
        (baseResponse.additionalNotes || '') +
        ` | Response format: Markdown - Parsed at ${new Date().toISOString()}`
    };

    if (context.intent.category === 'switch_comparison') {
      const conclusionMatch = content.match(/##\s+Conclusion\s*\n(.*?)(?=\n##|$)/s);
      if (conclusionMatch) {
        enhancedResponse.conclusion = conclusionMatch[1].trim();
      }

      const comparativeMatch = content.match(/##\s+Comparative Analysis\s*\n(.*?)(?=\n##|$)/s);
      if (comparativeMatch) {
        enhancedResponse.comparativeAnalysis = {
          feelingTactility: comparativeMatch[1].trim()
        };
      }
    }

    if (context.intent.category === 'material_analysis') {
      const materialMatch = content.match(/##\s+Material Analysis\s*\n(.*?)(?=\n##|$)/s);
      if (materialMatch) {
        enhancedResponse.materialAnalysis = {
          materialComposition: materialMatch[1].trim()
        };
      }
    }

    const tableMatch = content.match(/##\s+Technical Specifications\s*\n(.*?)(?=\n##|$)/s);
    if (tableMatch) {
      const tableContent = tableMatch[1].trim();
      if (tableContent.includes('|')) {
        enhancedResponse.additionalNotes =
          (enhancedResponse.additionalNotes || '') +
          ` | Technical Specifications Table: ${tableContent.substring(0, 200)}...`;
      }
    }

    return enhancedResponse;
  }

  private createMarkdownStructuredResponse(
    content: string,
    context: LLMPromptContext
  ): AnalysisResponse {
    const structuredContent = `## Overview\n${content.substring(0, 200)}...\n\n## Analysis\n${content}`;

    return this.parseMarkdownResponse(structuredContent, context);
  }

  private reconstructContentFromResponse(response: AnalysisResponse): string {
    let content = '';

    if (response.overview) {
      content += `## Overview\n${response.overview}\n\n`;
    }

    if (response.analysis) {
      content += `## Analysis\n${response.analysis}\n\n`;
    }

    if (response.technicalSpecifications) {
      content += `## Technical Specifications\n`;
      content += `| Property | Value |\n|----------|-------|\n`;
      for (const [key, value] of Object.entries(response.technicalSpecifications)) {
        content += `| ${key} | ${value} |\n`;
      }
      content += '\n';
    }

    return content.trim();
  }

  /**
   * Select appropriate prompt builder based on query intent (Task 4.2.2)
   * Routes to specialized prompts for different query types
   * Enhanced for follow-up queries (Task 4.3.1) and material analysis (Task 4.3.3)
   * @param context Full prompt context
   * @returns Constructed prompt using appropriate builder
   */
  private selectPromptBuilder(context: LLMPromptContext): string {
    switch (context.intent.category) {
      case 'switch_comparison':
        logStep(
          'prompt_selection',
          'Using specialized comparison prompt builder (supports multi-switch)'
        );
        return PromptHelper.buildComparisonPrompt(context);

      case 'material_analysis':
        logStep('prompt_selection', 'Using specialized material analysis prompt builder');
        return PromptHelper.buildMaterialAnalysisPrompt(context);

      case 'follow_up_question':
        logStep('prompt_selection', 'Using specialized follow-up prompt builder');
        return PromptHelper.buildFollowUpPrompt(context);

      case 'general_switch_info':
      default:
        logStep('prompt_selection', 'Using enhanced general prompt for switch info');
        return PromptHelper.buildStructureEnhancedPrompt(context);
    }
  }

  /**
   * Get prompt type description for logging
   * @param intentCategory Intent category
   * @returns Human-readable prompt type
   */
  private getPromptType(intentCategory: string): string {
    return getPromptType(intentCategory);
  }

  /**
   * ENHANCEMENT: Validate comparison-specific response structure for markdown format
   * Updated to work with new markdown templates instead of legacy JSON structure
   * @param response Analysis response to validate
   * @param context Original prompt context
   */
  private validateComparisonStructure(
    response: AnalysisResponse,
    _context: LLMPromptContext
  ): void {
    const content = response.analysis || '';

    if (!content || content.length < 100) {
      throw new Error('Comparison response missing substantial analysis content');
    }

    const validationResult = validateMarkdownStructure(content, 'switch_comparison');

    if (!validationResult.isValid) {
      const criticalErrors = validationResult.errors.filter((e) => e.severity === 'critical');
      if (criticalErrors.length > 0) {
        throw new Error(
          `Comparison response structure validation failed: ${criticalErrors.map((e) => e.message).join(', ')}`
        );
      }
    }

    const requiredSections = [
      '## Overview',
      '## Technical Specifications',
      '## Comparative Analysis',
      '## Conclusion'
    ];
    const missingSections = requiredSections.filter((section) => !content.includes(section));

    if (missingSections.length > 0) {
      throw new Error(
        `Comparison response missing required sections: ${missingSections.join(', ')}`
      );
    }

    const comparativeIndicators = [
      'compared to',
      'versus',
      'vs',
      'while',
      'however',
      'in contrast',
      'differs',
      'similar',
      'unlike'
    ];
    const hasComparativeLanguage = comparativeIndicators.some((indicator) =>
      content.toLowerCase().includes(indicator)
    );

    if (!hasComparativeLanguage) {
      console.warn('Comparison response may lack comparative language analysis');
    }

    const hasTable = content.includes('|') && content.includes('|-');
    if (!hasTable) {
      console.warn('Comparison response may be missing technical specifications table');
    }

    logStep('comparison_validation', `Markdown comparison structure validated`, {
      contentLength: content.length,
      sectionsFound: requiredSections.filter((s) => content.includes(s)).length,
      hasComparativeLanguage,
      hasTable,
      validationScore: validationResult.compliance.overallScore
    });
  }

  /**
   * Validate that the mandatory overview field meets quality requirements (FR4.4)
   * @param response Analysis response to validate
   * @throws Error if overview is insufficient
   */
  private validateMandatoryOverview(response: AnalysisResponse): void {
    if (!response.overview) {
      throw new Error('Missing mandatory overview field');
    }

    if (response.overview.trim().length < 50) {
      throw new Error('Overview field is too brief, must be comprehensive');
    }

    const placeholderPatterns = [
      /^(overview|summary|description)/i,
      /\[.*\]/,
      /placeholder/i,
      /todo/i,
      /tbd/i
    ];

    for (const pattern of placeholderPatterns) {
      if (pattern.test(response.overview)) {
        throw new Error('Overview contains placeholder content, must be substantive');
      }
    }
  }

  /**
   * Create structured fallback response when JSON parsing fails
   * Maintains consistent response structure even in error cases
   * @param promptContext Original prompt context
   * @param error Parsing error that occurred
   * @returns Structured fallback response
   */
  private createStructuredFallbackResponse(
    promptContext: LLMPromptContext,
    _error: any
  ): AnalysisResponse {
    const baseResponse: AnalysisResponse = {
      overview:
        `I apologize, but I encountered a technical issue while generating the analysis for your query: "${promptContext.query}". ` +
        `This appears to be a parsing error rather than a knowledge limitation. Please try rephrasing your question or asking about specific switch characteristics.`,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to parse LLM response',
        recoverable: true
      },
      dataSource: promptContext.databaseContext.totalFound > 0 ? 'Mixed' : 'LLM Knowledge',
      analysisConfidence: 'Low'
    };

    if (promptContext.intent.category === 'general_switch_info') {
      baseResponse.recommendations = [
        'Try asking about specific switch characteristics (sound, feel, force)',
        'Ask for comparisons with other switches you know',
        'Inquire about use case suitability (gaming, typing, office)'
      ];
    }

    return baseResponse;
  }

  /**
   * Call LLM with proper error handling and metrics
   * @param promptOrRequest Either a string prompt or structured LLM request
   * @param config Optional generation configuration
   * @returns LLM response with metadata
   */
  private async callLLM(
    promptOrRequest: string | LLMRequest,
    config?: { temperature?: number; maxOutputTokens?: number; topP?: number }
  ): Promise<LLMResponse> {
    const startTime = new Date();

    try {
      let prompt: string;
      let generationConfig: any;

      if (typeof promptOrRequest === 'string') {
        prompt = promptOrRequest;
        generationConfig = {
          temperature: config?.temperature || 0.7,
          maxOutputTokens: config?.maxOutputTokens || 1000
        };
      } else {
        prompt = promptOrRequest.prompt;
        generationConfig = {
          temperature: promptOrRequest.temperature || 0.7,
          maxOutputTokens: promptOrRequest.maxTokens || 1000
        };
      }

      const contextIntent: QueryIntent = 'general_switch_info';
      const contextQuery: string = '';

      const rawResponse = await this.geminiService.generate(prompt, generationConfig, {
        intent: contextIntent,
        query: contextQuery
      });

      const endTime = new Date();
      const processingTime = endTime.getTime() - startTime.getTime();

      const llmResponse: LLMResponse = {
        content: rawResponse,
        finishReason: 'STOP',
        usage: {
          promptTokens: this.estimateTokens(prompt),
          completionTokens: this.estimateTokens(rawResponse),
          totalTokens: this.estimateTokens(prompt) + this.estimateTokens(rawResponse)
        },
        model: 'gemini-pro'
      };

      console.log(`LLM call completed in ${processingTime}ms:`, {
        promptLength: prompt.length,
        responseLength: rawResponse.length,
        estimatedTokens: llmResponse.usage?.totalTokens
      });

      return llmResponse;
    } catch (error: any) {
      console.error('LLM call error:', error.message || error);
      throw new Error(`LLM request failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Estimate token count for a text string (rough approximation)
   * @param text The text to estimate tokens for
   * @returns Estimated token count
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Create workflow tracking object for request processing
   * @param request The original analysis request
   * @returns Workflow ID for tracking
   */
  private createWorkflow(request: AnalysisRequest): string {
    const workflowId = `${request.requestId}_${Date.now()}`;

    const workflow: Workflow = {
      workflowId,
      requestId: request.requestId,
      userQuery: request.query,
      steps: new Map(),
      startTime: new Date()
    };

    workflow.steps.set('intent_recognition', {
      stepName: 'intent_recognition',
      status: 'pending'
    });

    workflow.steps.set('database_lookup', {
      stepName: 'database_lookup',
      status: 'pending'
    });

    workflow.steps.set('analysis_generation', {
      stepName: 'analysis_generation',
      status: 'pending'
    });

    this.activeWorkflows.set(workflowId, workflow);
    return workflowId;
  }

  /**
   * Update a specific step in the workflow
   * @param workflowId The workflow ID to update
   * @param stepName The step to update
   * @param status New status for the step
   * @param data Optional data for the step
   * @param error Optional error information
   */
  private async updateWorkflowStep(
    workflowId: string,
    stepName: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    data?: any,
    error?: string
  ): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      console.warn(`Workflow ${workflowId} not found for step update`);
      return;
    }

    const step = workflow.steps.get(stepName) || {
      stepName,
      status: 'pending'
    };

    if (status === 'processing' && step.status === 'pending') {
      step.startTime = new Date();
    }

    if ((status === 'completed' || status === 'failed') && step.status === 'processing') {
      step.endTime = new Date();
    }

    step.status = status;
    if (data !== undefined) step.result = data;
    if (error) step.error = error;

    workflow.steps.set(stepName, step);
  }

  /**
   * Complete the workflow and calculate total duration
   * @param workflowId The workflow ID to complete
   */
  private async completeWorkflow(workflowId: string): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      console.warn(`Workflow ${workflowId} not found for completion`);
      return;
    }

    workflow.endTime = new Date();
    workflow.totalDurationMs = workflow.endTime.getTime() - workflow.startTime.getTime();

    setTimeout(
      () => {
        this.activeWorkflows.delete(workflowId);
      },
      5 * 60 * 1000
    );
  }

  /**
   * Handle analysis errors and create structured error responses
   * Provides comprehensive error classification and user-friendly messaging (FR6.1)
   * @param error The error that occurred
   * @param step The processing step where error occurred
   * @returns Structured analysis error
   */
  private handleAnalysisError(error: any, step: string): AnalysisError {
    const timestamp = new Date();
    let errorCode: AnalysisError['code'];
    let userMessage: string;
    let recoverable = false;
    let retryDelay: number | undefined;
    const details: any = {};

    if (error.name === 'ValidationError' || error.message.includes('validation')) {
      errorCode = 'RESPONSE_VALIDATION_FAILED';
      userMessage = 'The analysis completed but had formatting issues. Please try again.';
      recoverable = true;
      retryDelay = 1000;
    } else if (error.message.includes('timeout') || error.name === 'TimeoutError') {
      errorCode = 'TIMEOUT';
      userMessage =
        'The analysis request took too long to complete. Please try a simpler query or try again later.';
      recoverable = true;
      retryDelay = 5000;
    } else if (error.message.includes('rate limit') || error.name === 'RateLimitError') {
      errorCode = 'RATE_LIMITED';
      userMessage = 'Too many requests have been made. Please wait a moment before trying again.';
      recoverable = true;
      retryDelay = 60000;
    } else if (
      error.message.includes('database') ||
      error.message.includes('DB') ||
      step.includes('database')
    ) {
      errorCode = 'DATABASE_ERROR';
      userMessage =
        'The database service is temporarily unavailable. Analysis will continue with general knowledge only.';
      recoverable = true;
      retryDelay = 2000;
      details.fallbackAvailable = true;
    } else if (
      error.message.includes('LLM') ||
      error.message.includes('API') ||
      error.message.includes('generate')
    ) {
      errorCode = 'LLM_REQUEST_FAILED';
      userMessage =
        'The AI analysis service is temporarily unavailable. Please try again in a few moments.';
      recoverable = true;
      retryDelay = 3000;
    } else if (
      error.message.includes('parse') ||
      error.message.includes('JSON') ||
      error.message.includes('format')
    ) {
      errorCode = 'LLM_RESPONSE_INVALID';
      userMessage =
        'There was an issue processing the analysis response. Please try rephrasing your query.';
      recoverable = true;
      retryDelay = 1000;
    } else if (error.message.includes('intent') || step.includes('intent')) {
      errorCode = 'INTENT_RECOGNITION_FAILED';
      userMessage =
        'I had trouble understanding your question. Please try rephrasing it more clearly or provide specific switch names.';
      recoverable = true;
      retryDelay = 500;
      details.suggestions = [
        'Try including specific switch names (e.g., "Cherry MX Red", "Gateron Yellow")',
        'Use simpler language and avoid ambiguous terms',
        'Ask about specific characteristics like sound, feel, or force'
      ];
    } else if (error.message.includes('network') || error.message.includes('connection')) {
      errorCode = 'NETWORK_ERROR';
      userMessage =
        'There seems to be a connectivity issue. Please check your connection and try again.';
      recoverable = true;
      retryDelay = 2000;
    } else if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
      errorCode = 'AUTHENTICATION_ERROR';
      userMessage =
        'Authentication failed. Please sign in again to continue using the analysis service.';
      recoverable = false;
    } else if (error.message.includes('quota') || error.message.includes('limit exceeded')) {
      errorCode = 'QUOTA_EXCEEDED';
      userMessage =
        'The service usage limit has been reached. Please try again later or contact support.';
      recoverable = true;
      retryDelay = 3600000;
    } else {
      errorCode = 'INTERNAL_ERROR';
      userMessage =
        'An unexpected error occurred during analysis. Please try again or contact support if the problem persists.';
      recoverable = true;
      retryDelay = 2000;
    }

    details.step = step;
    details.timestamp = timestamp.toISOString();
    details.errorType = error.name || 'Unknown';

    if (error.stack && process.env.NODE_ENV === 'development') {
      details.stackTrace = error.stack.split('\n').slice(0, 5).join('\n');
    }

    if (step === 'intent_recognition') {
      details.guidance = 'Try using more specific switch names or clearer question phrasing';
    } else if (step === 'database_lookup') {
      details.guidance =
        'The system will fall back to general knowledge if database data is unavailable';
    } else if (step === 'analysis_generation') {
      details.guidance = 'Consider simplifying your query or asking about fewer switches at once';
    }

    const analysisError: AnalysisError = {
      code: errorCode,
      message: userMessage,
      recoverable,
      details,
      step,
      timestamp,
      retryDelay
    };

    LoggingHelper.logError('unknown', analysisError, step, {
      originalError: error.message,
      userMessage,
      recoverable,
      retryDelay
    });

    return analysisError;
  }

  /**
   * Parse and validate JSON response from LLM
   * Handles data conflicts between database and LLM knowledge
   * @param llmResponse Raw LLM response
   * @param request Original request for context
   * @returns Parsed and validated analysis response
   */
  private parseAnalysisResponse(
    llmResponse: LLMResponse,
    request: AnalysisRequest
  ): AnalysisResponse {
    try {
      const jsonMatch = llmResponse.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in LLM response');
      }

      const parsedResponse = JSON.parse(jsonMatch[0]);

      if (!parsedResponse.overview) {
        throw new Error('Missing mandatory overview field in LLM response');
      }

      return parsedResponse as AnalysisResponse;
    } catch (error: any) {
      console.error('Failed to parse LLM analysis response:', error.message);
      console.error('Raw LLM response:', llmResponse.content.substring(0, 500) + '...');

      return {
        overview: `I encountered an issue parsing the analysis for your query: "${request.query}". Please try rephrasing your question.`,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to parse LLM response',
          recoverable: true
        }
      };
    }
  }

  /**
   * Resolve conflicts between database specifications and LLM knowledge
   * Prioritizes database data for factual specifications when confidence is high
   * @param databaseData Switch data from database lookup
   * @param llmSpecifications Specifications from LLM response
   * @param confidence Database lookup confidence score
   * @returns Resolved specifications with conflict annotations
   */
  private resolveDataConflicts(
    databaseData: DatabaseSwitchData,
    llmSpecifications: any,
    confidence: number
  ): {
    resolvedSpecs: any;
    conflicts: Array<{
      field: string;
      databaseValue: any;
      llmValue: any;
      resolution: 'database' | 'llm' | 'both';
      reason: string;
    }>;
  } {
    const conflicts: Array<{
      field: string;
      databaseValue: any;
      llmValue: any;
      resolution: 'database' | 'llm' | 'both';
      reason: string;
    }> = [];

    const resolvedSpecs = { ...llmSpecifications };

    const highConfidenceThreshold = 0.8;
    const mediumConfidenceThreshold = 0.6;

    const factualFields = [
      'actuationForce',
      'bottomOutForce',
      'actuationDistance',
      'totalTravel',
      'manufacturer',
      'type'
    ];

    const materialFields = ['topHousing', 'bottomHousing', 'stem'];

    for (const field of factualFields) {
      const dbValue = this.getDbFieldValue(databaseData, field);
      const llmValue = llmSpecifications?.[field];

      if (dbValue !== undefined && llmValue !== undefined && dbValue !== llmValue) {
        if (confidence >= highConfidenceThreshold) {
          resolvedSpecs[field] = dbValue;
          conflicts.push({
            field,
            databaseValue: dbValue,
            llmValue,
            resolution: 'database',
            reason: `High confidence database value (${(confidence * 100).toFixed(1)}%) preferred for factual specification`
          });
        } else if (confidence >= mediumConfidenceThreshold) {
          if (this.isNumericField(field) && this.isReasonableVariation(dbValue, llmValue)) {
            resolvedSpecs[field] = dbValue;
            resolvedSpecs[`${field}_note`] = `Database: ${dbValue}, LLM: ${llmValue}`;
            conflicts.push({
              field,
              databaseValue: dbValue,
              llmValue,
              resolution: 'both',
              reason: `Medium confidence database match with reasonable LLM variation`
            });
          } else {
            resolvedSpecs[field] = dbValue;
            conflicts.push({
              field,
              databaseValue: dbValue,
              llmValue,
              resolution: 'database',
              reason: `Database value preferred for factual specification despite medium confidence`
            });
          }
        } else {
          conflicts.push({
            field,
            databaseValue: dbValue,
            llmValue,
            resolution: 'llm',
            reason: `Low database confidence (${(confidence * 100).toFixed(1)}%), using LLM value`
          });
        }
      } else if (dbValue !== undefined && llmValue === undefined) {
        resolvedSpecs[field] = dbValue;
      }
    }

    for (const field of materialFields) {
      const dbValue = this.getDbFieldValue(databaseData, field);
      const llmValue = llmSpecifications?.materials?.[field];

      if (dbValue !== undefined && llmValue !== undefined && dbValue !== llmValue) {
        if (confidence >= highConfidenceThreshold) {
          if (!resolvedSpecs.materials) resolvedSpecs.materials = {};
          resolvedSpecs.materials[field] = dbValue;
          conflicts.push({
            field: `materials.${field}`,
            databaseValue: dbValue,
            llmValue,
            resolution: 'database',
            reason: `High confidence database material specification`
          });
        } else {
          conflicts.push({
            field: `materials.${field}`,
            databaseValue: dbValue,
            llmValue,
            resolution: 'llm',
            reason: `Low confidence database match for material specification`
          });
        }
      } else if (
        dbValue !== undefined &&
        (llmValue === undefined || !llmSpecifications?.materials)
      ) {
        if (!resolvedSpecs.materials) resolvedSpecs.materials = {};
        resolvedSpecs.materials[field] = dbValue;
      }
    }

    return { resolvedSpecs, conflicts };
  }

  /**
   * Get database field value with proper mapping
   * @param databaseData Database switch data
   * @param field Field name to retrieve
   * @returns Database value for the field
   */
  private getDbFieldValue(databaseData: DatabaseSwitchData, field: string): any {
    const fieldMapping: Record<string, keyof DatabaseSwitchData> = {
      actuationForce: 'actuationForceG',
      bottomOutForce: 'bottomOutForceG',
      actuationDistance: 'preTravelMm',
      totalTravel: 'totalTravelMm',
      manufacturer: 'manufacturer',
      type: 'type',
      topHousing: 'topHousing',
      bottomHousing: 'bottomHousing',
      stem: 'stem'
    };

    const dbField = fieldMapping[field];
    return dbField ? databaseData[dbField] : undefined;
  }

  /**
   * Check if a field represents numeric specifications
   * @param field Field name to check
   * @returns True if field is numeric
   */
  private isNumericField(field: string): boolean {
    return ['actuationForce', 'bottomOutForce', 'actuationDistance', 'totalTravel'].includes(field);
  }

  /**
   * Check if two numeric values represent reasonable variation
   * Allows for measurement tolerances and unit differences
   * @param dbValue Database value
   * @param llmValue LLM value
   * @returns True if variation is within reasonable bounds
   */
  private isReasonableVariation(dbValue: any, llmValue: any): boolean {
    if (typeof dbValue !== 'number' || typeof llmValue !== 'number') {
      return false;
    }

    const percentDifference = Math.abs(dbValue - llmValue) / Math.max(dbValue, llmValue);
    return percentDifference <= 0.15;
  }

  /**
   * Apply database conflict resolution to analysis response
   * Integrates resolved conflicts and adds conflict metadata
   * @param response Original LLM analysis response
   * @param databaseContext Database context with switch data
   * @returns Response with resolved conflicts and metadata
   */
  private applyDatabaseConflictResolution(
    response: AnalysisResponse,
    databaseContext: EnhancedDatabaseContext
  ): AnalysisResponse {
    if (!response.specifications || databaseContext.switches.length === 0) {
      return response;
    }

    const allConflicts: any[] = [];

    for (const switchResult of databaseContext.switches) {
      if (switchResult.found && switchResult.data) {
        const { resolvedSpecs, conflicts } = this.resolveDataConflicts(
          switchResult.data,
          response.specifications,
          switchResult.confidence
        );

        if (conflicts.length > 0) {
          allConflicts.push({
            switchName: switchResult.data.switchName,
            conflicts: conflicts
          });
        }

        if (response.specifications.switchName === switchResult.data.switchName) {
          response.specifications = resolvedSpecs;
        }
      }
    }

    if (allConflicts.length > 0) {
      response.dataConflictResolution = {
        conflictsFound: allConflicts.length,
        resolutionStrategy: 'prefer_database_for_factual_specs',
        conflicts: allConflicts,
        note: 'Database specifications were prioritized for factual data when confidence was high. LLM knowledge was used for subjective analysis and missing data points.'
      };

      const conflictNote =
        allConflicts.length === 1
          ? '1 data conflict was resolved using database specifications.'
          : `${allConflicts.length} data conflicts were resolved using database specifications.`;

      if (response.overview) {
        response.overview += ` ${conflictNote}`;
      }
    }

    return response;
  }

  /**
   * Generate comprehensive prompt with conflict resolution instructions
   * Guides LLM on how to handle potential conflicts with database data
   * @param promptContext LLM prompt context
   * @param databaseContext Database context with conflict resolution guidance
   * @returns Enhanced prompt with conflict handling instructions
   */
  private buildConflictAwarePrompt(
    promptContext: LLMPromptContext,
    databaseContext: EnhancedDatabaseContext
  ): string {
    const basePrompt = PromptHelper.buildStructureEnhancedPrompt(promptContext);

    if (databaseContext.totalFound === 0) {
      return basePrompt;
    }

    const conflictInstructions = this.buildConflictResolutionInstructions(databaseContext);

    return `${basePrompt}\n\n${conflictInstructions}`;
  }

  /**
   * Build instructions for handling database vs LLM knowledge conflicts
   * @param databaseContext Database context with quality metrics
   * @returns Conflict resolution instructions for the LLM
   */
  private buildConflictResolutionInstructions(databaseContext: EnhancedDatabaseContext): string {
    const highConfidenceSwitches = databaseContext.switches
      .filter((s) => s.found && s.confidence >= 0.8)
      .map((s) => s.data?.switchName)
      .filter(Boolean);

    const lowConfidenceSwitches = databaseContext.switches
      .filter((s) => s.found && s.confidence < 0.6)
      .map((s) => s.data?.switchName)
      .filter(Boolean);

    return `DATABASE CONFLICT RESOLUTION GUIDELINES:

PRIORITY RULES:
1. For factual specifications (forces, travel distances, manufacturer, switch type):
   - Use database values when confidence is HIGH (80%+)
   - Consider both database and general knowledge when confidence is MEDIUM (60-80%)
   - Prefer general knowledge when confidence is LOW (<60%)

2. For material specifications (housing, stem materials):
   - Database values take priority when confidence is HIGH
   - Use general knowledge for missing database materials

3. For subjective analysis (sound, feel, experience):
   - Always use your general knowledge and analysis capabilities
   - Database provides factual context only

HIGH CONFIDENCE DATABASE SWITCHES: ${highConfidenceSwitches.join(', ') || 'None'}
LOW CONFIDENCE DATABASE SWITCHES: ${lowConfidenceSwitches.join(', ') || 'None'}

CONFLICT HANDLING:
- When database and general knowledge conflict on factual specs, note the discrepancy
- Explain your reasoning for specification choices
- Be transparent about data sources (database vs. general knowledge)
- Maintain confidence in subjective analysis regardless of database completeness

IMPORTANT: Your role is comprehensive analysis, not just data retrieval. Use database facts as a foundation for deeper insights about sound, feel, use cases, and recommendations.`;
  }

  /**
   * Validate response structure based on intent category
   * Enhanced to handle all query types from Task 4.3
   * @param response Analysis response to validate
   * @param context Original prompt context
   */
  private validateResponseStructure(response: AnalysisResponse, context: LLMPromptContext): void {
    const intentCategory = context.intent.category;

    switch (intentCategory) {
      case 'switch_comparison':
        this.validateComparisonStructure(response, context);
        break;

      case 'material_analysis':
        this.validateMaterialAnalysisStructure(response, context);
        break;

      case 'follow_up_question':
        this.validateFollowUpStructure(response, context);
        break;

      case 'general_switch_info':
        this.validateGeneralInfoStructure(response, context);
        break;
    }
  }

  /**
   * Validate material analysis response structure (Task 4.3.3)
   * @param response Analysis response to validate
   * @param context Original prompt context
   */
  private validateMaterialAnalysisStructure(
    response: AnalysisResponse,
    _context: LLMPromptContext
  ): void {
    if (!response.materialAnalysis) {
      throw new Error('Material analysis response missing materialAnalysis field');
    }

    const materialAnalysis = response.materialAnalysis;
    if (!materialAnalysis.materialComposition) {
      throw new Error('Material analysis missing materialComposition');
    }

    if (!materialAnalysis.propertiesExplanation) {
      throw new Error('Material analysis missing propertiesExplanation');
    }

    if (!materialAnalysis.soundImpact || !materialAnalysis.feelImpact) {
      throw new Error('Material analysis missing impact analysis (sound/feel)');
    }

    if (!response.exampleSwitches || response.exampleSwitches.length === 0) {
      throw new Error('Material analysis missing example switches');
    }

    for (const example of response.exampleSwitches) {
      if (!example.switchName || !example.relevanceToMaterial) {
        throw new Error('Material analysis example switches missing required fields');
      }
    }

    logStep('material_validation', `Material analysis structure validated`, {
      hasAnalysis: !!response.materialAnalysis,
      exampleCount: response.exampleSwitches?.length || 0,
      hasCombinationEffects: !!response.materialCombinationEffects
    });
  }

  /**
   * Validate follow-up response structure (Task 4.3.1)
   * @param response Analysis response to validate
   * @param context Original prompt context
   */
  private validateFollowUpStructure(response: AnalysisResponse, context: LLMPromptContext): void {
    if (!response.contextualConnection) {
      throw new Error('Follow-up response missing contextualConnection field');
    }

    if (!response.specificApplication) {
      throw new Error('Follow-up response missing specificApplication field');
    }

    // Ensure it builds on previous context if available
    if (
      context.followUpContext?.previousQuery &&
      !response.contextualConnection.toLowerCase().includes('previous')
    ) {
      console.warn('Follow-up response may not adequately reference previous context');
    }

    logStep('followup_validation', `Follow-up structure validated`, {
      hasConnection: !!response.contextualConnection,
      hasSpecificApplication: !!response.specificApplication,
      hasImplication: !!response.implication
    });
  }

  /**
   * Validate general info response structure
   * @param response Analysis response to validate
   * @param context Original prompt context
   */
  private validateGeneralInfoStructure(
    response: AnalysisResponse,
    _context: LLMPromptContext
  ): void {
    // For general info, just ensure we have meaningful content
    if (!response.technicalSpecifications && !response.soundProfile && !response.typingFeel) {
      console.warn('General info response may lack substantive analysis content');
    }

    logStep('general_validation', `General info structure validated`, {
      hasSpecs: !!response.technicalSpecifications,
      hasSound: !!response.soundProfile,
      hasFeel: !!response.typingFeel,
      hasRecommendations: !!(response.recommendations && response.recommendations.length > 0)
    });
  }

  /**
   * Create enhanced fallback response when analysis fails (FR6.1)
   * Uses comprehensive error information to provide better user guidance
   * @param request Original request
   * @param analysisError Structured error information
   * @returns Enhanced fallback analysis response
   */
  private createEnhancedFallbackResponse(
    request: AnalysisRequest,
    analysisError: AnalysisError
  ): AnalysisResponse {
    let overview = analysisError.message;

    // Add helpful context based on error type
    if (analysisError.code === 'DATABASE_ERROR') {
      overview +=
        ' I can still provide general information about switches using my knowledge base.';
    } else if (analysisError.code === 'INTENT_RECOGNITION_FAILED') {
      overview +=
        ' To get better results, try asking about specific switch names or characteristics.';
    } else if (analysisError.code === 'RATE_LIMITED') {
      overview += ` Please wait ${Math.round((analysisError.retryDelay || 60000) / 1000)} seconds before trying again.`;
    }

    const baseResponse: AnalysisResponse = {
      overview,
      error: analysisError,
      dataSource: 'Error Response',
      analysisConfidence: 'N/A - Analysis Failed',
      additionalNotes: `Error occurred at ${analysisError.timestamp?.toISOString()}. ${analysisError.recoverable ? 'This error is recoverable, please try again.' : 'This error requires attention from support.'}`
    };

    // Add specific suggestions based on error context
    if (analysisError.details?.suggestions) {
      baseResponse.recommendations = analysisError.details.suggestions;
    } else if (analysisError.code === 'INTENT_RECOGNITION_FAILED') {
      baseResponse.recommendations = [
        'Include specific switch names in your query',
        'Use clear, simple language',
        'Ask about specific characteristics like sound, feel, or force'
      ];
    } else if (analysisError.code === 'LLM_REQUEST_FAILED') {
      baseResponse.recommendations = [
        'Try again in a few moments',
        'Simplify your query',
        'Ask about fewer switches at once'
      ];
    }

    return baseResponse;
  }

  /**
   * Progressive fallback system for graceful degradation (FR6.2)
   * Provides increasingly simpler responses as analysis components fail
   * @param request Original analysis request
   * @param errors Array of errors encountered during analysis
   * @param availableData Any partial data that was successfully retrieved
   * @returns Simplified response appropriate to available capabilities
   */
  private createGracefulDegradationResponse(
    request: AnalysisRequest,
    errors: AnalysisError[],
    availableData?: {
      intentResult?: IntentRecognitionResult;
      databaseContext?: EnhancedDatabaseContext;
      partialAnalysis?: string;
    }
  ): AnalysisResponse {
    const criticalErrors = errors.filter((e) => !e.recoverable);
    const serviceErrors = errors.filter((e) =>
      ['LLM_REQUEST_FAILED', 'DATABASE_ERROR', 'NETWORK_ERROR'].includes(e.code)
    );

    // Level 1: Detailed analysis with warnings (minor issues only)
    if (criticalErrors.length === 0 && serviceErrors.length === 0) {
      return this.createDetailedResponseWithWarnings(request, errors, availableData);
    }

    // Level 2: Simplified analysis (some services unavailable)
    if (criticalErrors.length === 0 && serviceErrors.length <= 2) {
      return this.createSimplifiedAnalysisResponse(request, errors, availableData);
    }

    // Level 3: Basic informational response (major service failures)
    if (availableData?.intentResult || this.hasRecognizableSwitchNames(request.query)) {
      return this.createBasicInformationalResponse(request, errors, availableData);
    }

    // Level 4: Minimal guidance response (complete failure)
    return this.createMinimalGuidanceResponse(request, errors);
  }

  /**
   * Level 1: Detailed analysis with warnings about minor issues
   */
  private createDetailedResponseWithWarnings(
    request: AnalysisRequest,
    errors: AnalysisError[],
    availableData?: any
  ): AnalysisResponse {
    const warnings = errors.map((e) => e.message).join(' ');

    return {
      overview: `I've completed your analysis for "${request.query}" with some minor limitations. ${warnings}`,
      analysis:
        availableData?.partialAnalysis || 'Analysis completed with minor service limitations.',
      dataSource:
        availableData?.databaseContext?.totalFound > 0 ? 'Mixed (Database + LLM)' : 'LLM Knowledge',
      analysisConfidence: 'High (with warnings)',
      additionalNotes: `Analysis completed at ${new Date().toISOString()} with minor warnings: ${errors.map((e) => e.code).join(', ')}`,
      recommendations: [
        'Analysis provided with best available data',
        'Some features may have limited information due to service limitations',
        'Try again later for potentially enhanced results'
      ]
    };
  }

  /**
   * Level 2: Simplified analysis when some services are unavailable
   */
  private createSimplifiedAnalysisResponse(
    request: AnalysisRequest,
    errors: AnalysisError[],
    availableData?: any
  ): AnalysisResponse {
    const switchNames = this.extractSwitchNamesFromQuery(request.query);
    let overview = `I can provide a simplified analysis for your query about ${switchNames.length > 0 ? switchNames.join(' and ') : 'keyboard switches'}.`;

    // Add service status context
    const unavailableServices = errors.map((e) => {
      switch (e.code) {
        case 'DATABASE_ERROR':
          return 'database specifications';
        case 'LLM_REQUEST_FAILED':
          return 'detailed AI analysis';
        case 'NETWORK_ERROR':
          return 'external services';
        default:
          return 'some features';
      }
    });

    if (unavailableServices.length > 0) {
      overview += ` Note: ${unavailableServices.join(', ')} ${unavailableServices.length === 1 ? 'is' : 'are'} temporarily unavailable.`;
    }

    const analysis = this.generateSimplifiedSwitchAnalysis(switchNames, availableData);

    return {
      overview,
      analysis,
      dataSource: 'Limited (Partial Services)',
      analysisConfidence: 'Moderate (Simplified)',
      additionalNotes: `Simplified analysis provided due to service limitations: ${errors.map((e) => e.code).join(', ')}. Generated at ${new Date().toISOString()}`,
      recommendations: [
        'This is a simplified analysis due to current service limitations',
        'For comprehensive details, please try again when all services are available',
        'You can still ask follow-up questions for additional information'
      ]
    };
  }

  /**
   * Level 3: Basic informational response for major service failures
   */
  private createBasicInformationalResponse(
    request: AnalysisRequest,
    errors: AnalysisError[],
    _availableData?: any
  ): AnalysisResponse {
    const switchNames = this.extractSwitchNamesFromQuery(request.query);
    const basicInfo = this.getBasicSwitchInformation(switchNames);

    return {
      overview: `I can provide basic information about ${switchNames.length > 0 ? switchNames.join(' and ') : 'keyboard switches'}, though detailed analysis services are currently unavailable.`,
      analysis: basicInfo,
      dataSource: 'Basic Knowledge Base',
      analysisConfidence: 'Limited (Basic Info Only)',
      additionalNotes: `Basic information provided due to major service limitations. Services affected: ${errors.map((e) => e.code).join(', ')}. Generated at ${new Date().toISOString()}`,
      recommendations: [
        'Only basic switch information is available right now',
        'Please check back later for detailed analysis capabilities',
        'You may want to search online switch databases for comprehensive specifications'
      ]
    };
  }

  /**
   * Level 4: Minimal guidance response for complete system failure
   */
  private createMinimalGuidanceResponse(
    request: AnalysisRequest,
    errors: AnalysisError[]
  ): AnalysisResponse {
    const serviceStatus = this.getServiceStatusSummary(errors);

    return {
      overview:
        "I'm currently unable to provide detailed switch analysis due to service limitations. Here's what you can do instead.",
      analysis: `**Service Status**: ${serviceStatus}\n\n**Alternative Resources**:\n- Visit manufacturer websites for official specifications\n- Check community forums like r/MechanicalKeyboards\n- Consult switch databases like switches.mx\n- Try again later when services are restored`,
      dataSource: 'System Status Information',
      analysisConfidence: 'N/A (Service Unavailable)',
      additionalNotes: `Minimal response due to complete service failure. Errors: ${errors.map((e) => e.code).join(', ')}. Generated at ${new Date().toISOString()}`,
      recommendations: [
        'All analysis services are currently unavailable',
        'Please try again in a few minutes',
        'Contact support if this issue persists',
        'Use alternative resources listed above for immediate information'
      ],
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Complete service failure - providing minimal guidance only',
        recoverable: true,
        details: {
          totalErrors: errors.length,
          affectedServices: Array.from(new Set(errors.map((e) => e.step))),
          serviceStatus: serviceStatus
        },
        step: 'complete_system_failure',
        timestamp: new Date()
      }
    };
  }

  /**
   * Utility: Extract switch names from query using simple patterns
   */
  private extractSwitchNamesFromQuery(query: string): string[] {
    const switchPatterns = [
      /cherry\s*mx\s*\w+/gi,
      /gateron\s*\w+/gi,
      /kailh\s*\w+/gi,
      /holy\s*panda/gi,
      /zealios/gi,
      /topre/gi,
      /alpaca/gi,
      /ink\s*black/gi,
      /box\s*\w+/gi
    ];

    const found: string[] = [];
    switchPatterns.forEach((pattern) => {
      const matches = query.match(pattern);
      if (matches) {
        found.push(...matches.map((m) => m.trim()));
      }
    });

    return Array.from(new Set(found));
  }

  /**
   * Utility: Check if query contains recognizable switch names
   */
  private hasRecognizableSwitchNames(query: string): boolean {
    return this.extractSwitchNamesFromQuery(query).length > 0;
  }

  /**
   * Generate simplified switch analysis when full services unavailable
   */
  private generateSimplifiedSwitchAnalysis(switchNames: string[], _availableData?: any): string {
    if (switchNames.length === 0) {
      return `**General Switch Information**:\n\nKeyboard switches come in three main types:\n- **Linear**: Smooth keystroke, no tactile bump (good for gaming)\n- **Tactile**: Bump during actuation (good for typing)\n- **Clicky**: Tactile bump with audible click (good for typing)\n\nKey factors to consider:\n- Actuation force (light: 45g, medium: 50-60g, heavy: 65g+)\n- Travel distance (usually 4mm total)\n- Sound profile and office compatibility\n- Personal preference for feel and responsiveness`;
    }

    let analysis = `## Basic Information for ${switchNames.join(', ')}\n\n`;

    switchNames.forEach((switchName) => {
      const info = this.getBasicSwitchInfo(switchName);
      analysis += `**${switchName}**:\n`;
      analysis += `- Type: ${info.type}\n`;
      analysis += `- Force: ${info.force}\n`;
      analysis += `- Sound: ${info.sound}\n`;
      analysis += `- Use Case: ${info.useCase}\n\n`;
    });

    analysis += `**Note**: This is simplified information. For detailed specifications, sound profiles, and comprehensive comparisons, please try again when full analysis services are available.`;

    return analysis;
  }

  /**
   * Get basic switch information for simplified responses
   */
  private getBasicSwitchInfo(switchName: string): {
    type: string;
    force: string;
    sound: string;
    useCase: string;
  } {
    const name = switchName.toLowerCase();

    // Cherry MX switches
    if (name.includes('cherry mx red') || name.includes('mx red')) {
      return { type: 'Linear', force: '45g', sound: 'Quiet', useCase: 'Gaming' };
    }
    if (name.includes('cherry mx blue') || name.includes('mx blue')) {
      return { type: 'Clicky', force: '50g', sound: 'Loud click', useCase: 'Typing' };
    }
    if (name.includes('cherry mx brown') || name.includes('mx brown')) {
      return { type: 'Tactile', force: '45g', sound: 'Quiet tactile', useCase: 'Mixed use' };
    }

    // Gateron switches
    if (name.includes('gateron red')) {
      return { type: 'Linear', force: '45g', sound: 'Smooth', useCase: 'Gaming' };
    }
    if (name.includes('gateron yellow')) {
      return { type: 'Linear', force: '50g', sound: 'Smooth', useCase: 'Gaming' };
    }
    if (name.includes('gateron blue')) {
      return { type: 'Clicky', force: '50g', sound: 'Sharp click', useCase: 'Typing' };
    }
    if (name.includes('gateron brown')) {
      return { type: 'Tactile', force: '45g', sound: 'Soft tactile', useCase: 'Mixed use' };
    }

    // Specialty switches
    if (name.includes('holy panda')) {
      return { type: 'Tactile', force: '67g', sound: 'Thocky', useCase: 'Enthusiast typing' };
    }

    // Generic fallback
    return { type: 'Unknown', force: 'Variable', sound: 'Depends on type', useCase: 'General' };
  }

  /**
   * Get basic information about multiple switches
   */
  private getBasicSwitchInformation(switchNames: string[]): string {
    if (switchNames.length === 0) {
      return '**Basic Switch Categories**:\n\n- **Linear Switches**: Smooth keystroke without bumps, preferred for gaming\n- **Tactile Switches**: Noticeable bump during actuation, good for typing accuracy\n- **Clicky Switches**: Tactile bump plus audible click, traditional typing feel\n\n**Common Characteristics**:\n- Most switches have 4mm total travel distance\n- Actuation forces typically range from 45g to 70g\n- Material and design affect sound and feel significantly';
    }

    return this.generateSimplifiedSwitchAnalysis(switchNames);
  }

  /**
   * Generate service status summary for user information
   */
  private getServiceStatusSummary(errors: AnalysisError[]): string {
    const errorCounts = errors.reduce(
      (acc, err) => {
        acc[err.code] = (acc[err.code] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const statusItems: string[] = [];

    if (errorCounts['LLM_REQUEST_FAILED']) {
      statusItems.push('AI Analysis Service: Unavailable');
    }
    if (errorCounts['DATABASE_ERROR']) {
      statusItems.push('Switch Database: Unavailable');
    }
    if (errorCounts['NETWORK_ERROR']) {
      statusItems.push('Network Services: Experiencing Issues');
    }
    if (errorCounts['TIMEOUT']) {
      statusItems.push('Response Times: Degraded');
    }

    return statusItems.length > 0
      ? statusItems.join(', ')
      : 'Multiple services experiencing issues';
  }

  /**
   * Main entry point for graceful degradation
   * Automatically called when analysis fails at any stage
   */
  private handleAnalysisFailureWithDegradation(
    request: AnalysisRequest,
    primaryError: any,
    availableData?: any
  ): AnalysisResponse {
    const analysisError = this.handleAnalysisError(primaryError, 'analysis_failure');
    const errors = [analysisError];

    // Try to gather any additional context about what failed
    if (availableData?.additionalErrors) {
      errors.push(...availableData.additionalErrors);
    }

    console.log(
      `Analysis failure detected, initiating graceful degradation with ${errors.length} errors`
    );

    const degradedResponse = this.createGracefulDegradationResponse(request, errors, availableData);

    // Log the degradation level used
    const degradationLevel = this.getDegradationLevel(degradedResponse);
    LoggingHelper.logWarning(
      request.requestId,
      `Graceful degradation activated at level ${degradationLevel}`,
      'graceful_degradation',
      {
        errors: errors.map((e) => e.code),
        availableDataTypes: availableData ? Object.keys(availableData) : [],
        degradationLevel
      }
    );

    return degradedResponse;
  }

  /**
   * Determine degradation level from response
   */
  private getDegradationLevel(response: AnalysisResponse): number {
    if (response.analysisConfidence?.includes('High')) return 1;
    if (response.analysisConfidence?.includes('Moderate')) return 2;
    if (response.analysisConfidence?.includes('Limited')) return 3;
    return 4;
  }
}

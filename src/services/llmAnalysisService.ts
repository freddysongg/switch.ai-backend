/**
 * LLM Analysis Service for Switch Analysis Feature
 *
 * Encapsulates all logic related to LLM interaction, prompt engineering,
 * and response processing for the switch analysis feature. Integrates with
 * database services to provide comprehensive switch analysis.
 */

import type {
  AnalysisError,
  AnalysisRequest,
  AnalysisResponse,
  AnalysisWorkflow,
  DatabaseContext,
  DatabaseSwitchData,
  EnhancedDatabaseContext,
  IntentRecognitionResult,
  LLMPromptContext,
  LLMRequest,
  LLMResponse,
  QueryIntent,
  Workflow,
  WorkflowStep
} from '../types/analysisTypes.js';
import { PromptHelper } from '../utils/promptHelper.js';
import { DatabaseService } from './databaseService.js';
import { GeminiService } from './gemini.js';

// Helper functions for logging since the logging module doesn't export these
function logStep(step: string, message: string, data?: any): void {
  console.log(`[${step}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

function logWorkflowStart(workflowId: string, query: string): void {
  console.log(`[WORKFLOW_START] ${workflowId}: ${query}`);
}

function logWorkflowComplete(workflowId: string): void {
  console.log(`[WORKFLOW_COMPLETE] ${workflowId}`);
}

function logError(workflowId: string, step: string, error: any): void {
  console.error(`[ERROR] ${workflowId} ${step}:`, error);
}

export class LLMAnalysisService {
  private geminiService: GeminiService;
  private databaseService: DatabaseService;
  private activeWorkflows: Map<string, Workflow> = new Map();

  constructor() {
    this.geminiService = new GeminiService();
    this.databaseService = new DatabaseService();
  }

  /**
   * Main orchestration method for processing analysis requests
   * Coordinates intent recognition, database lookup, and LLM response generation
   * @param request The analysis request from the user
   * @returns Complete analysis response with database-enhanced context
   */
  async processAnalysisRequest(request: AnalysisRequest): Promise<AnalysisResponse> {
    const workflowId = this.createWorkflow(request);

    try {
      logWorkflowStart(workflowId, request.query);

      await this.updateWorkflowStep(workflowId, 'intent_recognition', 'processing');
      const intentResult = await this.recognizeIntent(request.query);
      await this.updateWorkflowStep(workflowId, 'intent_recognition', 'completed', intentResult);

      await this.updateWorkflowStep(workflowId, 'database_lookup', 'processing');
      const databaseContext = await this.fetchDatabaseContext(intentResult, request);
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

      const llmResponse = await this.generateAnalysisResponse(promptContext);

      // Apply database conflict resolution (FR2.4)
      const resolvedResponse = this.applyDatabaseConflictResolution(llmResponse, databaseContext);

      this.enhanceResponseWithDatabaseMetadata(resolvedResponse, databaseContext);

      await this.updateWorkflowStep(
        workflowId,
        'analysis_generation',
        'completed',
        resolvedResponse
      );

      await this.completeWorkflow(workflowId);

      return resolvedResponse;
    } catch (error: any) {
      logError(workflowId, 'analysis_processing', error);
      await this.updateWorkflowStep(workflowId, 'error_handling', 'failed', {
        error: error.message
      });

      return this.createFallbackResponse(request, error);
    }
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
        lookupOptions
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
   * Recognize user intent from the query
   * Uses LLM to classify intent and extract relevant entities
   * @param query The user's query string
   * @returns Intent recognition result with extracted entities
   */
  async recognizeIntent(query: string): Promise<IntentRecognitionResult> {
    const startTime = new Date();

    try {
      const prompt = PromptHelper.buildIntentRecognitionPrompt(query);

      const llmResponse = await this.geminiService.generate(prompt, {
        temperature: 0.1,
        maxOutputTokens: 500
      });

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

        return {
          intent: 'unknown',
          category: 'unknown',
          confidence: 0.0,
          extractedEntities: {
            switches: [],
            materials: [],
            properties: []
          },
          entities: {
            switches: [],
            materials: [],
            properties: []
          },
          reasoning: 'Failed to parse LLM response for intent recognition'
        };
      }

      const intentResult: IntentRecognitionResult = {
        intent: this.validateIntent(parsedResponse.intent),
        category: this.validateIntent(parsedResponse.intent),
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
              intent: this.validateIntent(alt.intent),
              confidence: Math.min(Math.max(alt.confidence || 0, 0), 1)
            }))
          : []
      };

      const processingTime = new Date().getTime() - startTime.getTime();

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

      return {
        intent: 'unknown',
        category: 'unknown',
        confidence: 0.0,
        extractedEntities: {
          switches: [],
          materials: [],
          properties: []
        },
        entities: {
          switches: [],
          materials: [],
          properties: []
        },
        reasoning: `Error during intent recognition: ${error.message || 'Unknown error'}`
      };
    }
  }

  /**
   * Validate and normalize intent values
   * Maps common variations to standard intent categories
   * @param intent Raw intent string from LLM
   * @returns Valid QueryIntent
   */
  private validateIntent(intent: string): QueryIntent {
    const validIntents: QueryIntent[] = [
      'general_switch_info',
      'switch_comparison',
      'material_analysis',
      'follow_up_question',
      'unknown'
    ];

    if (validIntents.includes(intent as QueryIntent)) {
      return intent as QueryIntent;
    }

    const intentLower = intent.toLowerCase();
    if (intentLower.includes('comparison') || intentLower.includes('compare')) {
      return 'switch_comparison';
    }
    if (intentLower.includes('material')) {
      return 'material_analysis';
    }
    if (intentLower.includes('follow') || intentLower.includes('context')) {
      return 'follow_up_question';
    }
    if (intentLower.includes('switch') || intentLower.includes('general')) {
      return 'general_switch_info';
    }

    return 'unknown';
  }

  /**
   * Generate LLM response given complete context
   * Implements comprehensive analysis generation with proper JSON handling (Task 4.1.2)
   * Enhanced for comparison queries (Task 4.2.2)
   * @param promptContext Complete context for LLM prompt construction
   * @returns Structured analysis response
   */
  async generateAnalysisResponse(promptContext: LLMPromptContext): Promise<AnalysisResponse> {
    try {
      // Select appropriate prompt builder based on intent (Task 4.2.2)
      const prompt = this.selectPromptBuilder(promptContext);

      logStep('analysis_generation', 'Generating LLM analysis response', {
        intentCategory: promptContext.intent.category,
        promptLength: prompt.length,
        switchesInContext: promptContext.databaseContext.totalFound,
        promptType: this.getPromptType(promptContext.intent.category)
      });

      const llmResponse = await this.callLLM(prompt, {
        temperature: 0.3,
        maxOutputTokens: 3000, // Increased for comparison queries
        topP: 0.9
      });

      const analysisResponse = this.parseAndValidateAnalysisResponse(llmResponse, promptContext);

      this.validateMandatoryOverview(analysisResponse);

      // Additional validation for comparison queries
      if (promptContext.intent.category === 'switch_comparison') {
        this.validateComparisonStructure(analysisResponse, promptContext);
      }

      logStep('analysis_generation', 'LLM analysis response generated successfully', {
        responseStructure: Object.keys(analysisResponse),
        overviewLength: analysisResponse.overview?.length || 0,
        tokensUsed: llmResponse.usage?.totalTokens,
        promptType: this.getPromptType(promptContext.intent.category)
      });

      return analysisResponse;
    } catch (error: any) {
      logError('analysis_generation', 'response_generation', error);
      throw new Error(`Analysis response generation failed: ${error.message}`);
    }
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
    switch (intentCategory) {
      case 'switch_comparison':
        return 'Specialized Comparison (2+ switches)';
      case 'material_analysis':
        return 'Material Analysis';
      case 'follow_up_question':
        return 'Follow-up Context';
      case 'general_switch_info':
        return 'General Switch Info';
      default:
        return 'Enhanced General';
    }
  }

  /**
   * Validate comparison-specific response structure (Task 4.2.2)
   * Ensures comparison queries return proper nested structure
   * @param response Analysis response to validate
   * @param context Original prompt context
   */
  private validateComparisonStructure(response: AnalysisResponse, context: LLMPromptContext): void {
    if (!response.comparedSwitches) {
      throw new Error('Comparison response missing comparedSwitches field');
    }

    const switchNames = Object.keys(response.comparedSwitches);
    if (switchNames.length < 2) {
      throw new Error('Comparison response must include at least 2 switches');
    }

    // Validate each compared switch has required structure
    for (const switchName of switchNames) {
      const switchData = response.comparedSwitches[switchName];
      if (!switchData.specifications) {
        throw new Error(`Switch ${switchName} missing specifications in comparison`);
      }
      if (!switchData.individualAnalysis) {
        throw new Error(`Switch ${switchName} missing individualAnalysis in comparison`);
      }
    }

    if (!response.comparativeAnalysis) {
      throw new Error('Comparison response missing comparativeAnalysis field');
    }

    if (!response.conclusion) {
      throw new Error('Comparison response missing conclusion field');
    }

    logStep(
      'comparison_validation',
      `Comparison structure validated for ${switchNames.length} switches`,
      {
        switches: switchNames,
        hasComparativeAnalysis: !!response.comparativeAnalysis,
        hasConclusion: !!response.conclusion
      }
    );
  }

  /**
   * Parse and validate JSON response from LLM with enhanced error handling
   * Handles data conflicts between database and LLM knowledge
   * @param llmResponse Raw LLM response
   * @param promptContext Original prompt context for fallback
   * @returns Parsed and validated analysis response
   */
  private parseAndValidateAnalysisResponse(
    llmResponse: LLMResponse,
    promptContext: LLMPromptContext
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
    } catch (parseError: any) {
      console.error('Failed to parse LLM analysis response:', parseError.message);
      console.error('Raw LLM response:', llmResponse.content.substring(0, 1000) + '...');

      return this.createStructuredFallbackResponse(promptContext, parseError);
    }
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
    error: any
  ): AnalysisResponse {
    const baseResponse: AnalysisResponse = {
      overview:
        `I apologize, but I encountered a technical issue while generating the analysis for your query: "${promptContext.query}". ` +
        `This appears to be a parsing error rather than a knowledge limitation. Please try rephrasing your question or asking about specific switch characteristics.`,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to parse LLM response into valid JSON',
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
   * Send request to LLM with prompt and config
   * Overloaded method for convenience
   * @param prompt The prompt string
   * @param config Generation configuration
   * @returns Raw LLM response
   */
  private async callLLM(
    prompt: string,
    config: { temperature?: number; maxOutputTokens?: number; topP?: number }
  ): Promise<LLMResponse>;

  /**
   * Send request to LLM and get raw response
   * Handles token estimation and performance tracking
   * @param llmRequest The structured LLM request
   * @returns Raw LLM response
   */
  private async callLLM(llmRequest: LLMRequest): Promise<LLMResponse>;

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
          maxOutputTokens: config?.maxOutputTokens || 1000,
          topP: config?.topP
        };
      } else {
        prompt = promptOrRequest.prompt;
        generationConfig = {
          temperature: promptOrRequest.temperature || 0.7,
          maxOutputTokens: promptOrRequest.maxTokens || 1000
        };
      }

      const rawResponse = await this.geminiService.generate(prompt, generationConfig);

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

    // Clean up completed workflow after a delay
    setTimeout(
      () => {
        this.activeWorkflows.delete(workflowId);
      },
      5 * 60 * 1000
    ); // Remove after 5 minutes
  }

  /**
   * Validate LLM response structure and content
   * TODO: Implement response validation
   * @param response The LLM response to validate
   * @returns Validation result with errors/warnings
   */
  private validateResponse(response: any): { isValid: boolean; errors: string[] } {
    throw new Error('LLMAnalysisService.validateResponse not yet implemented');
  }

  /**
   * Handle analysis errors and create structured error responses
   * TODO: Implement error handling
   * @param error The error that occurred
   * @param step The processing step where error occurred
   * @returns Structured analysis error
   */
  private handleAnalysisError(error: any, step: string): AnalysisError {
    throw new Error('LLMAnalysisService.handleAnalysisError not yet implemented');
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
    return percentDifference <= 0.15; // Allow 15% variation for measurement tolerances
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
    context: LLMPromptContext
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

    // Validate example switches structure
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
    context: LLMPromptContext
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
}

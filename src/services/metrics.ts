import { mapIntentToQueryType } from '../utils/intentMapping.js';

export interface ResponseQualityMetrics {
  responseId: string;
  requestId: string;
  timestamp: Date;

  databaseSpecAccuracy?: number;
  entityRecognitionAccuracy?: number;
  factVerificationScore?: number;

  formatComplianceScore: number;
  sectionCompletenessScore: number;
  tableStructureScore?: number;
  contentOrganizationScore?: number;

  technicalDetailPrecision?: number;
  relevanceScore?: number;
  comprehensivenessScore?: number;

  manualQualityRating?: number;
  manualComments?: string;
}

export interface UserExperienceMetrics {
  requestId: string;
  timestamp: Date;

  intentClassificationAccuracy: boolean;
  switchNameExtractionF1?: number;
  queryType: 'comparison' | 'general_info' | 'material_analysis' | 'follow_up' | 'unknown';

  queryResponseRelevance?: number;
  contextPreservationScore?: number;
  recommendationQuality?: number;

  userSatisfactionRating?: number;
  wasHelpful?: boolean;
  userFeedback?: string;
}

export interface TechnicalPerformanceMetrics {
  requestId: string;
  timestamp: Date;

  databaseHitRate: number;
  dataCompletenessScore: number;
  databaseResponseTime: number;

  llmResponseTime: number;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  totalResponseTime: number;
  errorOccurred: boolean;
  errorType?: string;

  conflictsDetected: number;
  conflictsResolved: number;
  conflictResolutionAccuracy?: number;
}

export interface EvaluationResult {
  testId: string;
  query: string;
  expectedIntent?: string;
  expectedEntities?: string[];
  expectedResponse?: Partial<any>;

  actualResponse: any;
  qualityMetrics: ResponseQualityMetrics;
  uxMetrics: UserExperienceMetrics;
  performanceMetrics: TechnicalPerformanceMetrics;

  overallScore: number;
  passed: boolean;
  notes?: string;
}

export interface MetricsAggregation {
  timeRange: { start: Date; end: Date };
  totalRequests: number;

  averageQuality: {
    formatCompliance: number;
    sectionCompleteness: number;
    technicalAccuracy: number;
    relevance: number;
  };

  averagePerformance: {
    responseTime: number;
    databaseHitRate: number;
    errorRate: number;
  };

  intentClassification: {
    accuracy: number;
    confusionMatrix: Record<string, Record<string, number>>;
  };

  userSatisfaction: {
    averageRating: number;
    helpfulnessRate: number;
  };
}

export class MetricsCollectionService {
  private metricsStore: Map<string, EvaluationResult> = new Map();

  /**
   * Record metrics for a completed analysis request
   */
  async recordAnalysisMetrics(
    requestId: string,
    request: any,
    response: any,
    processingContext: any
  ): Promise<void> {
    try {
      if (!response) {
        console.warn(`Recording metrics for failed request ${requestId} with null response`);
        const emptyEvaluation: EvaluationResult = {
          testId: requestId,
          query: request.query || 'unknown',
          actualResponse: null,
          qualityMetrics: this.createEmptyQualityMetrics(requestId),
          uxMetrics: this.createEmptyUXMetrics(requestId),
          performanceMetrics: this.createEmptyPerformanceMetrics(requestId, processingContext),
          overallScore: 0,
          passed: false,
          notes: 'Response was null/undefined - likely due to service failure'
        };

        this.metricsStore.set(requestId, emptyEvaluation);
        await this.persistMetrics(emptyEvaluation);
        return;
      }

      const qualityMetrics = await this.calculateQualityMetrics(
        request,
        response,
        processingContext
      );
      const uxMetrics = await this.calculateUXMetrics(request, response, processingContext);
      const performanceMetrics = await this.calculatePerformanceMetrics(processingContext);

      const evaluation: EvaluationResult = {
        testId: requestId,
        query: request.query,
        actualResponse: response,
        qualityMetrics,
        uxMetrics,
        performanceMetrics,
        overallScore: this.calculateOverallScore(qualityMetrics, uxMetrics, performanceMetrics),
        passed: this.determinePassFail(qualityMetrics, uxMetrics, performanceMetrics)
      };

      this.metricsStore.set(requestId, evaluation);

      await this.persistMetrics(evaluation);
    } catch (error: any) {
      console.error(`Failed to record metrics for request ${requestId}:`, error.message);

      const errorEvaluation: EvaluationResult = {
        testId: requestId,
        query: request.query || 'unknown',
        actualResponse: response,
        qualityMetrics: this.createEmptyQualityMetrics(requestId),
        uxMetrics: this.createEmptyUXMetrics(requestId),
        performanceMetrics: this.createEmptyPerformanceMetrics(requestId, processingContext),
        overallScore: 0,
        passed: false,
        notes: `Metrics calculation failed: ${error.message}`
      };

      this.metricsStore.set(requestId, errorEvaluation);
      await this.persistMetrics(errorEvaluation);
    }
  }

  /**
   * Calculate response quality metrics
   */
  private async calculateQualityMetrics(
    request: any,
    response: any,
    context: any
  ): Promise<ResponseQualityMetrics> {
    if (!response) {
      return this.createEmptyQualityMetrics(context.requestId);
    }

    return {
      responseId: response.id || context.requestId,
      requestId: context.requestId,
      timestamp: new Date(),

      formatComplianceScore: this.assessFormatCompliance(response),
      sectionCompletenessScore: this.assessSectionCompleteness(response, request),
      tableStructureScore: this.assessTableStructure(response),
      contentOrganizationScore: this.assessContentOrganization(response),

      entityRecognitionAccuracy: this.calculateEntityAccuracy(request, context),
      technicalDetailPrecision: this.assessTechnicalPrecision(response),
      relevanceScore: this.assessRelevance(request.query, response),
      comprehensivenessScore: this.assessDomainExpertise(response),

      databaseSpecAccuracy: await this.compareWithDatabaseIfApplicable(response, context)
    };
  }

  /**
   * Assess if response follows expected structure (JSON or markdown)
   */
  private assessFormatCompliance(response: any): number {
    if (!response || typeof response !== 'object') {
      return 0;
    }

    let score = 0;
    let maxScore = 0;

    if (
      response.overview &&
      typeof response.overview === 'string' &&
      response.overview.length > 10
    ) {
      score += 1;
    }
    maxScore += 1;

    if (response.technicalSpecs || response.technicalSpecifications) {
      const techSpecs = response.technicalSpecs || response.technicalSpecifications;
      if (
        (typeof techSpecs === 'string' && techSpecs.length > 10) ||
        (typeof techSpecs === 'object' && Object.keys(techSpecs).length > 0)
      ) {
        score += 1;
      }
    }
    maxScore += 1;

    if (response.analysis) {
      if (
        (typeof response.analysis === 'string' && response.analysis.length > 10) ||
        (typeof response.analysis === 'object' && Object.keys(response.analysis).length > 0)
      ) {
        score += 1;
      }
    } else if (response.materialAnalysis || response.typingFeel || response.soundProfile) {
      score += 1;
    }
    maxScore += 1;

    if (response.dataSource) {
      score += 1;
    }
    maxScore += 1;

    if (
      response.recommendations ||
      response.useCaseSuitability ||
      response.practicalRecommendations
    ) {
      score += 0.5;
    }
    maxScore += 0.5;

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Check if all required sections are present and substantive
   */
  private assessSectionCompleteness(response: any, _request: any): number {
    if (!response || typeof response !== 'object') {
      return 0;
    }

    let score = 0;
    let maxScore = 0;

    if (
      response.overview &&
      typeof response.overview === 'string' &&
      response.overview.length > 50
    ) {
      score += 1;
    }
    maxScore += 1;

    const techSpecs = response.technicalSpecs || response.technicalSpecifications;
    if (techSpecs) {
      if (typeof techSpecs === 'string' && techSpecs.length > 30) {
        score += 1;
      } else if (typeof techSpecs === 'object' && Object.keys(techSpecs).length >= 3) {
        score += 1;
      }
    }
    maxScore += 1;

    let hasAnalysis = false;
    const analysisFields = [
      'analysis',
      'materialAnalysis',
      'typingFeel',
      'soundProfile',
      'typingExperience',
      'buildQuality',
      'modifiability'
    ];

    for (const field of analysisFields) {
      if (response[field]) {
        if (typeof response[field] === 'string' && response[field].length > 30) {
          hasAnalysis = true;
          break;
        } else if (typeof response[field] === 'object' && Object.keys(response[field]).length > 0) {
          hasAnalysis = true;
          break;
        }
      }
    }

    if (hasAnalysis) {
      score += 1;
    }
    maxScore += 1;

    let bonusScore = 0;
    let bonusMaxScore = 0;

    if (response.recommendations || response.practicalRecommendations) {
      bonusScore += 0.5;
    }
    bonusMaxScore += 0.5;

    if (response.useCaseSuitability || response.bestUseCases) {
      bonusScore += 0.5;
    }
    bonusMaxScore += 0.5;

    const baseScore = score / maxScore;
    const bonusScoreNormalized = bonusMaxScore > 0 ? bonusScore / bonusMaxScore : 0;

    return baseScore * 0.8 + bonusScoreNormalized * 0.2;
  }

  /**
   * Assess table structure quality for comparisons
   */
  private assessTableStructure(response: any): number {
    const technicalSpecs =
      typeof response.technicalSpecs === 'string' ? response.technicalSpecs : '';

    if (!technicalSpecs || !technicalSpecs.includes('|')) {
      return 1;
    }

    const table = technicalSpecs;
    let score = 0;
    let maxScore = 0;

    if (table.includes('Switch Name') && table.includes('Manufacturer')) {
      score += 1;
    }
    maxScore += 1;

    if (table.includes('---') || table.includes('|---')) {
      score += 1;
    }
    maxScore += 1;

    const rows = table.split('\n').filter((row: string) => row.includes('|'));
    if (rows.length > 1) {
      const columnCounts = rows.map((row: string) => row.split('|').length);
      const consistent = columnCounts.every((count: number) => count === columnCounts[0]);
      if (consistent) {
        score += 1;
      }
    }
    maxScore += 1;

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Compare response specs with database only when applicable and high confidence
   */
  private async compareWithDatabaseIfApplicable(response: any, context: any): Promise<number> {
    if (!context.databaseContext || !context.databaseContext.switches) {
      return 1;
    }

    const highConfidenceSwitches = context.databaseContext.switches.filter(
      (s: any) => s.found && s.confidence > 0.8
    );

    if (highConfidenceSwitches.length === 0) {
      return 1;
    }

    let totalComparisons = 0;
    let accurateComparisons = 0;

    const responseSpecs = this.extractSpecsFromResponse(response);

    for (const dbSwitch of highConfidenceSwitches) {
      const dbData = dbSwitch.data;
      const responseData = responseSpecs[dbData.switchName];

      if (responseData) {
        const numericFields = ['actuationForceG', 'bottomOutForceG'];

        for (const field of numericFields) {
          if (dbData[field] && responseData[field]) {
            totalComparisons++;
            const tolerance = 0.15;
            const dbValue = parseFloat(dbData[field]);
            const responseValue = parseFloat(responseData[field]);

            if (Math.abs(dbValue - responseValue) / dbValue <= tolerance) {
              accurateComparisons++;
            }
          }
        }
      }
    }

    return totalComparisons > 0 ? accurateComparisons / totalComparisons : 1;
  }

  /**
   * Extract specifications from response text/structure
   */
  private extractSpecsFromResponse(_response: any): Record<string, any> {
    const specs: Record<string, any> = {};

    return specs;
  }

  /**
   * Calculate entity recognition accuracy (F1 score)
   */
  private calculateEntityAccuracy(request: any, context: any): number {
    if (!context.intentResult || !context.intentResult.extractedEntities) {
      return 1;
    }

    const extracted = context.intentResult.extractedEntities.switches || [];
    const expected = request.queryHints?.switchNames || [];

    if (expected.length === 0) {
      return 1;
    }

    const truePositives = extracted.filter((name: string) =>
      expected.some((exp: string) => exp.toLowerCase().includes(name.toLowerCase()))
    ).length;

    const precision = extracted.length > 0 ? truePositives / extracted.length : 0;
    const recall = expected.length > 0 ? truePositives / expected.length : 0;

    return precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  }

  /**
   * Assess technical detail precision
   */
  private assessTechnicalPrecision(response: any): number {
    let score = 0;
    let checks = 0;

    const content = JSON.stringify(response);

    if (content.includes('g') || content.includes('grams')) {
      score += 1;
    }
    checks += 1;

    if (content.includes('mm') || content.includes('millimeter')) {
      score += 1;
    }
    checks += 1;

    const forceMatches = content.match(/(\d+)g/g);
    if (forceMatches) {
      const reasonable = forceMatches.some((match) => {
        const value = parseInt(match);
        return value >= 20 && value <= 100;
      });
      if (reasonable) {
        score += 1;
      }
    }
    checks += 1;

    const travelMatches = content.match(/(\d+\.?\d*)mm/g);
    if (travelMatches) {
      const reasonable = travelMatches.some((match) => {
        const value = parseFloat(match);
        return value >= 0.5 && value <= 5;
      });
      if (reasonable) {
        score += 1;
      }
    }
    checks += 1;

    const keyTerms = ['linear', 'tactile', 'clicky', 'actuation', 'housing', 'stem'];
    const hasTerminology = keyTerms.some((term) => content.toLowerCase().includes(term));
    if (hasTerminology) {
      score += 1;
    }
    checks += 1;

    const materials = ['polycarbonate', 'nylon', 'abs', 'pom', 'aluminum', 'steel'];
    const hasMaterials = materials.some((material) => content.toLowerCase().includes(material));
    if (hasMaterials) {
      score += 1;
    }
    checks += 1;

    return checks > 0 ? score / checks : 0;
  }

  /**
   * Assess domain expertise and technical depth
   */
  private assessDomainExpertise(response: any): number {
    let score = 0;
    let maxScore = 0;

    const content = JSON.stringify(response).toLowerCase();

    const characteristics = [
      'sound profile',
      'typing feel',
      'spring weight',
      'key travel',
      'tactile bump',
      'click jacket',
      'stem design',
      'housing material'
    ];

    const mentionedCharacteristics = characteristics.filter((char) =>
      content.includes(char.toLowerCase())
    ).length;

    score += Math.min(mentionedCharacteristics / characteristics.length, 1);
    maxScore += 1;

    const useCases = ['gaming', 'typing', 'programming', 'office work'];
    const mentionedUseCases = useCases.filter((useCase) =>
      content.includes(useCase.toLowerCase())
    ).length;

    if (mentionedUseCases > 0) {
      score += 1;
    }
    maxScore += 1;

    const comparatives = ['compared to', 'versus', 'lighter than', 'heavier than', 'similar to'];
    const hasComparatives = comparatives.some((comp) => content.includes(comp));
    if (hasComparatives) {
      score += 1;
    }
    maxScore += 1;

    const nuancedTerms = ['however', 'although', 'depending on', 'varies', 'subjective'];
    const hasNuance = nuancedTerms.some((term) => content.includes(term));
    if (hasNuance) {
      score += 1;
    }
    maxScore += 1;

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Assess query-response relevance
   */
  private assessRelevance(query: string, response: any): number {
    if (!response || !query) {
      return 0;
    }

    const queryWords = query.toLowerCase().split(/\s+/);
    const responseText = JSON.stringify(response).toLowerCase();

    let relevantWords = 0;
    const importantWords = queryWords.filter(
      (word) =>
        word.length > 3 &&
        !['what', 'how', 'why', 'when', 'where', 'which', 'the', 'and', 'or'].includes(word)
    );

    for (const word of importantWords) {
      if (responseText.includes(word)) {
        relevantWords++;
      }
    }

    return importantWords.length > 0 ? relevantWords / importantWords.length : 0;
  }

  /**
   * Validate intent classification accuracy
   */
  private validateIntentClassification(request: any, context: any): boolean {
    const detectedIntent = context.intentResult?.intent;
    const expectedIntent = request.queryHints?.expectedIntent;

    if (!expectedIntent) {
      if (
        request.query.toLowerCase().includes('vs') ||
        request.query.toLowerCase().includes('compare')
      ) {
        return detectedIntent === 'switch_comparison';
      }
      if (request.query.toLowerCase().includes('material')) {
        return detectedIntent === 'material_analysis';
      }
      return true;
    }

    return detectedIntent === expectedIntent;
  }

  /**
   * Assess context preservation for follow-up queries
   */
  private assessContextPreservation(request: any, response: any): number {
    if (!request.followUpContext) {
      return 1;
    }

    const responseText = JSON.stringify(response).toLowerCase();
    const previousQuery = request.followUpContext.previousQuery?.toLowerCase();

    if (previousQuery) {
      const contextWords = previousQuery.split(/\s+/).filter((word: string) => word.length > 3);
      let contextReferences = 0;

      for (const word of contextWords) {
        if (responseText.includes(word)) {
          contextReferences++;
        }
      }

      return contextWords.length > 0 ? Math.min(1, contextReferences / contextWords.length) : 1;
    }

    return 1;
  }

  /**
   * Assess quality of recommendations
   */
  private assessRecommendationQuality(response: any): number {
    if (!response.recommendations) {
      return 0.5;
    }

    let recText: string;
    if (typeof response.recommendations === 'string') {
      recText = response.recommendations.toLowerCase();
    } else if (Array.isArray(response.recommendations)) {
      recText = response.recommendations.join(' ').toLowerCase();
    } else if (typeof response.recommendations === 'object') {
      recText = JSON.stringify(response.recommendations).toLowerCase();
    } else {
      return 0.5;
    }

    let score = 0;
    let maxScore = 0;

    if (
      recText.includes('consider') ||
      recText.includes('recommend') ||
      recText.includes('suggest')
    ) {
      score += 1;
    }
    maxScore += 1;

    if (
      recText.includes('alternative') ||
      recText.includes('similar') ||
      recText.includes('instead')
    ) {
      score += 1;
    }
    maxScore += 1;

    if (recText.includes('gaming') || recText.includes('typing') || recText.includes('office')) {
      score += 1;
    }
    maxScore += 1;

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Calculate performance metrics
   */
  private async calculatePerformanceMetrics(context: any): Promise<TechnicalPerformanceMetrics> {
    return {
      requestId: context.requestId,
      timestamp: new Date(),

      databaseHitRate: this.calculateDatabaseHitRate(context),
      dataCompletenessScore: this.calculateDataCompleteness(context),
      databaseResponseTime: context.databaseResponseTime || 0,

      llmResponseTime: context.llmResponseTime || 0,
      tokenUsage: context.tokenUsage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },

      totalResponseTime: context.totalResponseTime || 0,
      errorOccurred: !!context.error,
      errorType: context.error?.type,

      conflictsDetected: context.conflictsDetected || 0,
      conflictsResolved: context.conflictsResolved || 0,
      conflictResolutionAccuracy: this.calculateConflictResolutionAccuracy(context)
    };
  }

  private calculateDatabaseHitRate(context: any): number {
    if (!context.databaseContext || !context.databaseContext.switches) {
      return 1;
    }

    const total = context.databaseContext.switches.length;
    const found = context.databaseContext.switches.filter((s: any) => s.found).length;

    return total > 0 ? found / total : 1;
  }

  private calculateDataCompleteness(context: any): number {
    if (!context.databaseContext?.dataQuality) {
      return 0;
    }

    return context.databaseContext.dataQuality.overallCompleteness;
  }

  private calculateConflictResolutionAccuracy(context: any): number {
    if (!context.conflictsDetected || context.conflictsDetected === 0) {
      return 1;
    }

    return context.conflictsResolved / context.conflictsDetected;
  }

  /**
   * Calculate overall weighted score
   */
  private calculateOverallScore(
    quality: ResponseQualityMetrics,
    ux: UserExperienceMetrics,
    performance: TechnicalPerformanceMetrics
  ): number {
    const weights = {
      quality: 0.6,
      ux: 0.3,
      performance: 0.1
    };

    const qualityScore =
      quality.formatComplianceScore * 0.25 +
      quality.sectionCompletenessScore * 0.25 +
      (quality.relevanceScore || 0.7) * 0.2 +
      (quality.technicalDetailPrecision || 0.7) * 0.15 +
      (quality.comprehensivenessScore || 0.7) * 0.15;

    const uxScore =
      (ux.intentClassificationAccuracy ? 1 : 0) * 0.4 +
      (ux.switchNameExtractionF1 || 0.7) * 0.3 +
      (ux.queryResponseRelevance || 0.7) * 0.3;

    const performanceScore =
      (performance.totalResponseTime < 5000 ? 1 : 0.5) * 0.5 +
      (performance.errorOccurred ? 0 : 1) * 0.3 +
      performance.databaseHitRate * 0.2;

    return (
      qualityScore * weights.quality + uxScore * weights.ux + performanceScore * weights.performance
    );
  }

  /**
   * Determine pass/fail based on thresholds
   */
  private determinePassFail(
    quality: ResponseQualityMetrics,
    ux: UserExperienceMetrics,
    performance: TechnicalPerformanceMetrics
  ): boolean {
    const overallScore = this.calculateOverallScore(quality, ux, performance);

    const minimumThresholds = {
      formatCompliance: 0.2,
      sectionCompleteness: 0.3,
      intentAccuracy: true,
      noErrors: !performance.errorOccurred,
      overallScore: 0.4,
      technicalPrecision: 0.2
    };

    return (
      quality.formatComplianceScore >= minimumThresholds.formatCompliance &&
      quality.sectionCompletenessScore >= minimumThresholds.sectionCompleteness &&
      ux.intentClassificationAccuracy === minimumThresholds.intentAccuracy &&
      minimumThresholds.noErrors &&
      overallScore >= minimumThresholds.overallScore &&
      (quality.technicalDetailPrecision || 0) >= minimumThresholds.technicalPrecision
    );
  }

  /**
   * Persist metrics to database
   */
  private async persistMetrics(evaluation: EvaluationResult): Promise<void> {
    console.log('Persisting metrics for request:', evaluation.testId);
  }

  /**
   * Generate aggregated metrics report
   */
  async generateMetricsReport(timeRange: { start: Date; end: Date }): Promise<MetricsAggregation> {
    return {
      timeRange,
      totalRequests: 0,
      averageQuality: {
        formatCompliance: 0,
        sectionCompleteness: 0,
        technicalAccuracy: 0,
        relevance: 0
      },
      averagePerformance: {
        responseTime: 0,
        databaseHitRate: 0,
        errorRate: 0
      },
      intentClassification: {
        accuracy: 0,
        confusionMatrix: {}
      },
      userSatisfaction: {
        averageRating: 0,
        helpfulnessRate: 0
      }
    };
  }

  /**
   * Get metrics for a specific request
   */
  getMetricsForRequest(requestId: string): EvaluationResult | undefined {
    return this.metricsStore.get(requestId);
  }

  /**
   * Manual rating interface for human evaluation
   */
  async recordManualRating(
    requestId: string,
    qualityRating: number,
    helpful: boolean,
    comments?: string
  ): Promise<void> {
    const evaluation = this.metricsStore.get(requestId);
    if (evaluation) {
      evaluation.qualityMetrics.manualQualityRating = qualityRating;
      evaluation.qualityMetrics.manualComments = comments;
      evaluation.uxMetrics.wasHelpful = helpful;
      evaluation.uxMetrics.userFeedback = comments;

      await this.persistMetrics(evaluation);
    }
  }

  /**
   * Assess content organization and logical flow
   */
  private assessContentOrganization(response: any): number {
    let score = 0;
    let maxScore = 0;

    const content = JSON.stringify(response).toLowerCase();

    if (response.overview && response.technicalSpecs) {
      score += 1;
    }
    maxScore += 1;

    if (response.technicalSpecs && response.analysis) {
      score += 1;
    }
    maxScore += 1;

    if (response.analysis && response.recommendations) {
      score += 1;
    }
    maxScore += 1;

    if (
      content.includes('based on') ||
      content.includes('therefore') ||
      content.includes('given')
    ) {
      score += 1;
    }
    maxScore += 1;

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Create empty quality metrics for failed requests
   */
  private createEmptyQualityMetrics(requestId: string): ResponseQualityMetrics {
    return {
      responseId: requestId,
      requestId: requestId,
      timestamp: new Date(),
      formatComplianceScore: 0,
      sectionCompletenessScore: 0,
      tableStructureScore: 0,
      contentOrganizationScore: 0,
      entityRecognitionAccuracy: 0,
      technicalDetailPrecision: 0,
      relevanceScore: 0,
      comprehensivenessScore: 0,
      databaseSpecAccuracy: 0
    };
  }

  /**
   * Create empty UX metrics for failed requests
   */
  private createEmptyUXMetrics(requestId: string): UserExperienceMetrics {
    return {
      requestId: requestId,
      timestamp: new Date(),
      intentClassificationAccuracy: false,
      switchNameExtractionF1: 0,
      queryType: 'unknown',
      queryResponseRelevance: 0,
      contextPreservationScore: 0,
      recommendationQuality: 0
    };
  }

  /**
   * Create empty performance metrics for failed requests
   */
  private createEmptyPerformanceMetrics(
    requestId: string,
    context: any
  ): TechnicalPerformanceMetrics {
    return {
      requestId: requestId,
      timestamp: new Date(),
      databaseHitRate: 0,
      dataCompletenessScore: 0,
      databaseResponseTime: context?.databaseResponseTime || 0,
      llmResponseTime: context?.llmResponseTime || 0,
      tokenUsage: context?.tokenUsage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      totalResponseTime: context?.totalResponseTime || 0,
      errorOccurred: true,
      errorType: 'service_failure',
      conflictsDetected: 0,
      conflictsResolved: 0,
      conflictResolutionAccuracy: 0
    };
  }

  /**
   * Calculate UX metrics
   */
  private async calculateUXMetrics(
    request: any,
    response: any,
    context: any
  ): Promise<UserExperienceMetrics> {
    if (!response) {
      return this.createEmptyUXMetrics(context.requestId);
    }

    const rawIntent = context.intentResult?.intent || 'unknown';
    const mappedQueryType = mapIntentToQueryType(rawIntent);

    return {
      requestId: context.requestId,
      timestamp: new Date(),

      intentClassificationAccuracy: this.validateIntentClassification(request, context),
      switchNameExtractionF1: this.calculateEntityAccuracy(request, context),
      queryType: mappedQueryType,

      queryResponseRelevance: this.assessRelevance(request.query, response),
      contextPreservationScore: this.assessContextPreservation(request, response),
      recommendationQuality: this.assessRecommendationQuality(response)
    };
  }
}

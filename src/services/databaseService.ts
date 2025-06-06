/**
 * Database Service for Switch Analysis Feature
 *
 * Provides simple switch data lookups and normalization to support the LLM-powered
 * analysis feature with supplementary database context. Handles graceful degradation
 * when data is missing or incomplete.
 */

import { sql } from 'drizzle-orm';

import { arrayToVector, db, switches as switchesTable } from '../db/index.js';
import type {
  DatabaseContext,
  DatabaseLookupResult,
  DatabaseSwitchData,
  NormalizationResult
} from '../types/analysisTypes.js';
import { LoggingHelper } from '../utils/loggingHelper.js';
import { LocalEmbeddingService } from './embeddingsLocal.js';
import { GeminiService } from './gemini.js';

export class DatabaseService {
  private embeddingService: LocalEmbeddingService;
  private geminiService: GeminiService;
  private embeddingServiceAvailable: boolean = true;
  private llmNormalizationEnabled: boolean = true;

  constructor() {
    this.embeddingService = new LocalEmbeddingService();
    this.geminiService = new GeminiService();
  }

  /**
   * Primary method for fetching switch specifications based on normalized names
   * Uses multiple lookup strategies with graceful fallback handling
   * @param switchNames Array of switch names to lookup
   * @param options Lookup configuration options
   * @param requestId Optional request ID for logging
   * @returns Database context with lookup results and quality analysis
   */
  async fetchSwitchSpecifications(
    switchNames: string[],
    options: {
      confidenceThreshold?: number;
      maxSwitchesPerLookup?: number;
      enableEmbeddingSearch?: boolean;
      enableFuzzyMatching?: boolean;
      enableLLMNormalization?: boolean;
    } = {},
    requestId?: string
  ): Promise<DatabaseContext> {
    const startTime = Date.now();
    const {
      confidenceThreshold = 0.5,
      maxSwitchesPerLookup = 5,
      enableEmbeddingSearch = true,
      enableFuzzyMatching = true,
      enableLLMNormalization = true
    } = options;

    const limitedSwitchNames = switchNames.slice(0, maxSwitchesPerLookup);

    let normalizedNames = limitedSwitchNames;
    if (enableLLMNormalization && this.llmNormalizationEnabled) {
      try {
        const normalizationResults = await this.llmBasedNormalization(limitedSwitchNames);
        normalizedNames = normalizationResults.map((result) => result.normalized);

        console.log(
          'LLM normalization results:',
          normalizationResults.map(
            (r) =>
              `"${r.original}" → "${r.normalized}" (confidence: ${(r.confidence * 100).toFixed(1)}%)`
          )
        );
      } catch (error: any) {
        console.warn('LLM normalization failed, using simple normalization:', error.message);
        this.llmNormalizationEnabled = false;
        const simpleResults = await this.normalizeSwitchNames(limitedSwitchNames);
        normalizedNames = simpleResults.map((result) => result.normalized);
      }
    } else {
      const simpleResults = await this.normalizeSwitchNames(limitedSwitchNames);
      normalizedNames = simpleResults.map((result) => result.normalized);
    }

    const lookupResults: DatabaseLookupResult[] = [];

    console.log(
      `DatabaseService: Starting lookup for ${normalizedNames.length} normalized switches:`,
      normalizedNames
    );

    for (let i = 0; i < normalizedNames.length; i++) {
      const originalName = limitedSwitchNames[i];
      const normalizedName = normalizedNames[i];

      try {
        const result = await this.lookupSingleSwitch(
          normalizedName,
          confidenceThreshold,
          enableEmbeddingSearch,
          enableFuzzyMatching
        );

        if (!result.found && normalizedName !== originalName) {
          console.log(
            `Normalized lookup failed for "${normalizedName}", trying original "${originalName}"`
          );
          const fallbackResult = await this.lookupSingleSwitch(
            originalName,
            confidenceThreshold,
            enableEmbeddingSearch,
            enableFuzzyMatching
          );

          if (fallbackResult.found) {
            fallbackResult.normalizedName = originalName;
            lookupResults.push(fallbackResult);
          } else {
            lookupResults.push(result);
          }
        } else {
          lookupResults.push(result);
        }
      } catch (error: any) {
        console.error(`Failed to lookup switch "${normalizedName}":`, error.message);

        lookupResults.push({
          found: false,
          normalizedName: originalName,
          confidence: 0
        });
      }
    }

    const totalFound = lookupResults.filter((result) => result.found).length;
    const lookupTimeMs = Date.now() - startTime;

    console.log(
      `DatabaseService: Lookup completed. Found ${totalFound}/${limitedSwitchNames.length} switches`
    );

    const databaseContext: DatabaseContext = {
      switches: lookupResults,
      totalFound,
      totalRequested: limitedSwitchNames.length
    };

    if (requestId) {
      LoggingHelper.logDatabaseLookup(requestId, databaseContext, lookupTimeMs);
    }

    return databaseContext;
  }

  /**
   * LLM-based switch name normalization for better database matching
   * Uses Gemini to intelligently normalize switch names using industry standards
   * @param switchNames Array of raw switch names from user input
   * @returns Array of normalized switch names with confidence scores
   */
  async llmBasedNormalization(switchNames: string[]): Promise<NormalizationResult[]> {
    if (switchNames.length === 0) {
      return [];
    }

    try {
      const prompt = this.buildNormalizationPrompt(switchNames);

      const llmResponse = await this.geminiService.generate(prompt, {
        temperature: 0.1,
        maxOutputTokens: 800
      });

      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in LLM normalization response');
      }

      const parsedResponse = JSON.parse(jsonMatch[0]);

      if (!parsedResponse.normalizations || !Array.isArray(parsedResponse.normalizations)) {
        throw new Error('Invalid normalization response structure');
      }

      const results: NormalizationResult[] = [];

      for (let i = 0; i < switchNames.length; i++) {
        const original = switchNames[i];
        const normData = parsedResponse.normalizations[i] || {};

        results.push({
          original,
          normalized: normData.normalized || this.simpleNormalization(original),
          confidence: Math.min(Math.max(normData.confidence || 0.5, 0), 1),
          suggestions: Array.isArray(normData.suggestions) ? normData.suggestions : []
        });
      }

      return results;
    } catch (error: any) {
      console.error('LLM normalization error:', error.message);
      return this.normalizeSwitchNames(switchNames);
    }
  }

  /**
   * Build prompt for LLM-based switch name normalization
   * Provides comprehensive examples and normalization rules
   * @param switchNames Array of switch names to normalize
   * @returns Normalization prompt for the LLM
   */
  private buildNormalizationPrompt(switchNames: string[]): string {
    return `You are an expert mechanical keyboard switch analyst. Your task is to normalize switch names for accurate database lookup.

NORMALIZATION GOALS:
- Standardize manufacturer names and spacing
- Correct common misspellings and variations
- Maintain essential identifying information
- Use standard switch naming conventions

COMMON NORMALIZATION RULES:
- "Cherry MX" → "Cherry MX" (standard spacing)
- "gateron" → "Gateron" (proper capitalization)
- "Holy Panda" → "Holy Panda" (maintain community names)
- "Zealios" → "Zealios" (keep brand names as-is)
- "mx blue" → "Cherry MX Blue" (expand abbreviated forms)
- "kailh box white" → "Kailh BOX White" (proper BOX capitalization)

EXAMPLES:
Input: "cherry mx red"
Output: "Cherry MX Red"

Input: "gateron yellow"  
Output: "Gateron Yellow"

Input: "holy pandas"
Output: "Holy Panda"

Input: "zealios 67g"
Output: "Zealios 67g"

SWITCH NAMES TO NORMALIZE:
${switchNames.map((name, i) => `${i + 1}. "${name}"`).join('\n')}

REQUIRED OUTPUT FORMAT (JSON):
{
  "normalizations": [
    {
      "original": "input_name_1",
      "normalized": "normalized_name_1",
      "confidence": 0.95,
      "suggestions": ["alternative_1", "alternative_2"]
    }
  ]
}

INSTRUCTIONS:
- Provide exactly ${switchNames.length} normalization results in order
- Confidence should be 0.8+ for clear normalizations, 0.5-0.7 for uncertain ones
- Include up to 2 alternative suggestions if normalization is ambiguous
- Preserve switch characteristics (colors, weights, etc.)
- Use standard manufacturer names and proper capitalization

Respond with ONLY the JSON object, no additional text.`;
  }

  /**
   * Normalize switch names using simple rule-based approach
   * Fallback method when LLM normalization is unavailable
   * @param switchNames Array of raw switch names from user input
   * @returns Array of normalized switch names
   */
  async normalizeSwitchNames(switchNames: string[]): Promise<NormalizationResult[]> {
    const results: NormalizationResult[] = [];

    for (const switchName of switchNames) {
      const normalized = this.simpleNormalization(switchName);

      results.push({
        original: switchName,
        normalized: normalized,
        confidence: 0.8,
        suggestions: []
      });
    }

    return results;
  }

  /**
   * Simple rule-based switch name normalization
   * @param switchName Raw switch name
   * @returns Normalized switch name
   */
  private simpleNormalization(switchName: string): string {
    return switchName
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/mx\s+/gi, 'MX ')
      .replace(/gateron\s+/gi, 'Gateron ')
      .replace(/cherry\s+/gi, 'Cherry ')
      .replace(/kailh\s+/gi, 'Kailh ')
      .replace(/zealios/gi, 'Zealios')
      .replace(/holy\s+panda/gi, 'Holy Panda');
  }

  /**
   * Lookup a single switch using multiple strategies with prioritized fallback
   * @param switchName Name of the switch to lookup
   * @param confidenceThreshold Minimum confidence required for a match
   * @param enableEmbeddingSearch Whether to use embedding-based search
   * @param enableFuzzyMatching Whether to use fuzzy string matching
   * @returns Database lookup result for the switch
   */
  private async lookupSingleSwitch(
    switchName: string,
    confidenceThreshold: number,
    enableEmbeddingSearch: boolean,
    enableFuzzyMatching: boolean
  ): Promise<DatabaseLookupResult> {
    let bestMatch: any = null;
    let matchConfidence = 0;
    let strategy = 'none';

    if (enableEmbeddingSearch && this.embeddingServiceAvailable) {
      try {
        const embeddingResult = await this.embeddingBasedLookup(switchName);
        if (embeddingResult.confidence > matchConfidence) {
          bestMatch = embeddingResult.match;
          matchConfidence = embeddingResult.confidence;
          strategy = 'embedding';
        }
      } catch (error: any) {
        console.warn(`Embedding search failed for "${switchName}", falling back:`, error.message);
        this.embeddingServiceAvailable = false;
      }
    }

    if (!bestMatch || matchConfidence < 0.9) {
      try {
        const exactResult = await this.exactNameLookup(switchName);
        if (exactResult.confidence > matchConfidence) {
          bestMatch = exactResult.match;
          matchConfidence = exactResult.confidence;
          strategy = 'exact';
        }
      } catch (error: any) {
        console.warn(`Exact name lookup failed for "${switchName}":`, error.message);
      }
    }

    if (enableFuzzyMatching && (!bestMatch || matchConfidence < confidenceThreshold)) {
      try {
        const fuzzyResult = await this.fuzzyNameLookup(switchName);
        if (fuzzyResult.confidence > matchConfidence) {
          bestMatch = fuzzyResult.match;
          matchConfidence = fuzzyResult.confidence;
          strategy = 'fuzzy';
        }
      } catch (error: any) {
        console.warn(`Fuzzy lookup failed for "${switchName}":`, error.message);
      }
    }

    if (bestMatch && matchConfidence >= confidenceThreshold) {
      const switchData = this.formatSwitchData(bestMatch);

      console.log(
        `Found switch "${switchName}" using ${strategy} strategy (confidence: ${(matchConfidence * 100).toFixed(1)}%)`
      );

      return {
        found: true,
        data: switchData,
        normalizedName: bestMatch.name,
        confidence: matchConfidence
      };
    } else {
      console.log(
        `No match found for "${switchName}" (best confidence: ${(matchConfidence * 100).toFixed(1)}%)`
      );

      return {
        found: false,
        normalizedName: switchName,
        confidence: matchConfidence
      };
    }
  }

  /**
   * Embedding-based switch lookup using vector similarity
   * Most accurate search method when available
   * @param switchName Name of the switch to search for
   * @returns Match result with confidence score
   */
  private async embeddingBasedLookup(
    switchName: string
  ): Promise<{ match: any; confidence: number }> {
    const switchEmbedding = await this.embeddingService.embedText(switchName);
    const switchEmbeddingSql = arrayToVector(switchEmbedding);

    const results = await db.execute<{
      name: string;
      manufacturer: string;
      type: string | null;
      topHousing: string | null;
      bottomHousing: string | null;
      stem: string | null;
      mount: string | null;
      spring: string | null;
      actuationForce: number | null;
      bottomForce: number | null;
      preTravel: number | null;
      totalTravel: number | null;
      similarity: number;
    }>(sql`
      SELECT 
        s.name,
        s.manufacturer,
        s.type,
        s.top_housing as "topHousing",
        s.bottom_housing as "bottomHousing", 
        s.stem,
        s.mount,
        s.spring,
        s.actuation_force as "actuationForce",
        s.bottom_force as "bottomForce",
        s.pre_travel as "preTravel",
        s.total_travel as "totalTravel",
        1 - ((s.embedding::text)::vector <=> ${switchEmbeddingSql}) AS similarity
      FROM ${switchesTable} AS s
      ORDER BY similarity DESC
      LIMIT 1
    `);

    if (results.length === 0) {
      return { match: null, confidence: 0 };
    }

    return {
      match: results[0],
      confidence: results[0].similarity
    };
  }

  /**
   * Exact name matching lookup
   * @param switchName Name of the switch to search for
   * @returns Match result with confidence score
   */
  private async exactNameLookup(switchName: string): Promise<{ match: any; confidence: number }> {
    const results = await db.execute<{
      name: string;
      manufacturer: string;
      type: string | null;
      topHousing: string | null;
      bottomHousing: string | null;
      stem: string | null;
      mount: string | null;
      spring: string | null;
      actuationForce: number | null;
      bottomForce: number | null;
      preTravel: number | null;
      totalTravel: number | null;
    }>(sql`
      SELECT 
        s.name,
        s.manufacturer,
        s.type,
        s.top_housing as "topHousing",
        s.bottom_housing as "bottomHousing", 
        s.stem,
        s.mount,
        s.spring,
        s.actuation_force as "actuationForce",
        s.bottom_force as "bottomForce",
        s.pre_travel as "preTravel",
        s.total_travel as "totalTravel"
      FROM ${switchesTable} AS s
      WHERE LOWER(s.name) = LOWER(${switchName})
      LIMIT 1
    `);

    if (results.length === 0) {
      return { match: null, confidence: 0 };
    }

    return {
      match: results[0],
      confidence: 1.0
    };
  }

  /**
   * Fuzzy name matching lookup using LIKE patterns
   * @param switchName Name of the switch to search for
   * @returns Match result with confidence score
   */
  private async fuzzyNameLookup(switchName: string): Promise<{ match: any; confidence: number }> {
    const results = await db.execute<{
      name: string;
      manufacturer: string;
      type: string | null;
      topHousing: string | null;
      bottomHousing: string | null;
      stem: string | null;
      mount: string | null;
      spring: string | null;
      actuationForce: number | null;
      bottomForce: number | null;
      preTravel: number | null;
      totalTravel: number | null;
      similarity: number;
    }>(sql`
      SELECT 
        s.name,
        s.manufacturer,
        s.type,
        s.top_housing as "topHousing",
        s.bottom_housing as "bottomHousing", 
        s.stem,
        s.mount,
        s.spring,
        s.actuation_force as "actuationForce",
        s.bottom_force as "bottomForce",
        s.pre_travel as "preTravel",
        s.total_travel as "totalTravel",
        CASE 
          WHEN LOWER(s.name) LIKE LOWER(${switchName + '%'}) THEN 0.9
          WHEN LOWER(s.name) LIKE LOWER(${'%' + switchName + '%'}) THEN 0.8
          WHEN LOWER(s.manufacturer || ' ' || s.name) LIKE LOWER(${'%' + switchName + '%'}) THEN 0.7
          ELSE 0.6
        END AS similarity
      FROM ${switchesTable} AS s
      WHERE LOWER(s.name) LIKE LOWER(${'%' + switchName + '%'})
         OR LOWER(s.manufacturer || ' ' || s.name) LIKE LOWER(${'%' + switchName + '%'})
      ORDER BY similarity DESC
      LIMIT 1
    `);

    if (results.length === 0) {
      return { match: null, confidence: 0 };
    }

    return {
      match: results[0],
      confidence: results[0].similarity
    };
  }

  /**
   * Format database row data into DatabaseSwitchData interface
   * @param rawData Raw data from database query
   * @returns Formatted switch data
   */
  private formatSwitchData(rawData: any): DatabaseSwitchData {
    return {
      switchName: rawData.name || '',
      manufacturer: rawData.manufacturer || undefined,
      type: rawData.type || undefined,
      topHousing: rawData.topHousing || undefined,
      bottomHousing: rawData.bottomHousing || undefined,
      stem: rawData.stem || undefined,
      mount: rawData.mount || undefined,
      spring: rawData.spring || undefined,
      actuationForceG: rawData.actuationForce || undefined,
      bottomOutForceG: rawData.bottomForce || undefined,
      preTravelMm: rawData.preTravel || undefined,
      totalTravelMm: rawData.totalTravel || undefined,
      factoryLubed: undefined,
      additionalNotesDb: undefined
    };
  }

  /**
   * Analyze data completeness for a switch record
   * Evaluates missing fields and overall data quality
   * @param switchData Formatted switch data
   * @returns Data completeness analysis
   */
  private analyzeDataCompleteness(switchData: DatabaseSwitchData): {
    completenessScore: number;
    missingFields: string[];
    criticalFieldsMissing: boolean;
    hasSpecifications: boolean;
  } {
    const criticalFields = ['switchName', 'manufacturer'];
    const specificationFields = [
      'type',
      'topHousing',
      'bottomHousing',
      'stem',
      'mount',
      'spring',
      'actuationForceG',
      'bottomOutForceG',
      'preTravelMm',
      'totalTravelMm'
    ];
    const allFields = [...criticalFields, ...specificationFields];

    const missingFields: string[] = [];
    let presentFields = 0;

    for (const field of allFields) {
      const value = switchData[field as keyof DatabaseSwitchData];
      if (value === undefined || value === null || value === '') {
        missingFields.push(field);
      } else {
        presentFields++;
      }
    }

    const completenessScore = presentFields / allFields.length;

    const criticalFieldsMissing = criticalFields.some((field) => missingFields.includes(field));

    const hasSpecifications = specificationFields.some((field) => !missingFields.includes(field));

    return {
      completenessScore,
      missingFields,
      criticalFieldsMissing,
      hasSpecifications
    };
  }

  /**
   * Enhanced database context creation with completeness analysis
   * Provides comprehensive quality metrics for decision making
   * @param lookupResults Array of database lookup results
   * @param originalSwitchNames Original switch names requested
   * @returns Enhanced database context with completeness information
   */
  createEnhancedDatabaseContext(
    lookupResults: DatabaseLookupResult[],
    originalSwitchNames: string[]
  ): DatabaseContext & {
    dataQuality: {
      overallCompleteness: number;
      switchesWithIncompleteData: string[];
      switchesNotFound: string[];
      hasAnyData: boolean;
      recommendLLMFallback: boolean;
    };
    usage: {
      successfulLookups: number;
      failedLookups: number;
      lowConfidenceLookups: number;
      incompleteDataCount: number;
    };
  } {
    const switchesWithIncompleteData: string[] = [];
    const switchesNotFound: string[] = [];
    let totalCompleteness = 0;
    let successfulLookups = 0;
    let failedLookups = 0;
    let lowConfidenceLookups = 0;
    let incompleteDataCount = 0;

    for (let i = 0; i < lookupResults.length; i++) {
      const result = lookupResults[i];
      const originalName = originalSwitchNames[i] || `switch_${i + 1}`;

      if (!result.found) {
        switchesNotFound.push(originalName);
        failedLookups++;
        continue;
      }

      successfulLookups++;

      if (result.confidence && result.confidence < 0.7) {
        lowConfidenceLookups++;
      }

      if (result.data) {
        const completeness = this.analyzeDataCompleteness(result.data);
        totalCompleteness += completeness.completenessScore;

        if (completeness.completenessScore < 0.6 || !completeness.hasSpecifications) {
          switchesWithIncompleteData.push(originalName);
          incompleteDataCount++;
        }
      }
    }

    const overallCompleteness = successfulLookups > 0 ? totalCompleteness / successfulLookups : 0;
    const hasAnyData = successfulLookups > 0;
    const recommendLLMFallback =
      failedLookups > successfulLookups ||
      overallCompleteness < 0.4 ||
      incompleteDataCount > successfulLookups / 2;

    return {
      switches: lookupResults,
      totalFound: lookupResults.filter((r) => r.found).length,
      totalRequested: originalSwitchNames.length,
      dataQuality: {
        overallCompleteness,
        switchesWithIncompleteData,
        switchesNotFound,
        hasAnyData,
        recommendLLMFallback
      },
      usage: {
        successfulLookups,
        failedLookups,
        lowConfidenceLookups,
        incompleteDataCount
      }
    };
  }

  /**
   * Get database availability status with detailed diagnostics
   * @returns Comprehensive database status
   */
  async getDatabaseStatus(): Promise<{
    isAvailable: boolean;
    embeddingServiceAvailable: boolean;
    llmNormalizationAvailable: boolean;
    diagnostics: {
      connectionTest: boolean;
      switchTableAccessible: boolean;
      embeddingServiceTest: boolean;
      sampleSwitchCount: number;
    };
    lastChecked: Date;
  }> {
    const lastChecked = new Date();
    const diagnostics = {
      connectionTest: false,
      switchTableAccessible: false,
      embeddingServiceTest: false,
      sampleSwitchCount: 0
    };

    try {
      await db.execute(sql`SELECT 1 as test`);
      diagnostics.connectionTest = true;
    } catch (error) {
      console.error('Database connection test failed:', error);
    }

    try {
      const countResult = await db.execute<{ count: number }>(
        sql`SELECT COUNT(*) as count FROM ${switchesTable} LIMIT 1`
      );
      diagnostics.switchTableAccessible = true;
      diagnostics.sampleSwitchCount = countResult[0]?.count || 0;
    } catch (error) {
      console.error('Switch table access test failed:', error);
    }

    try {
      await this.embeddingService.embedText('test');
      diagnostics.embeddingServiceTest = true;
    } catch (error) {
      console.error('Embedding service test failed:', error);
      this.embeddingServiceAvailable = false;
    }

    const isAvailable = diagnostics.connectionTest && diagnostics.switchTableAccessible;

    return {
      isAvailable,
      embeddingServiceAvailable: this.embeddingServiceAvailable,
      llmNormalizationAvailable: this.llmNormalizationEnabled,
      diagnostics,
      lastChecked
    };
  }

  /**
   * Handle database service degradation gracefully
   * Provides intelligent fallback strategies based on error type
   * @param error The error that occurred
   * @param operation The operation that failed
   * @returns Fallback strategy recommendation
   */
  handleServiceDegradation(
    error: any,
    operation: string
  ): {
    shouldRetry: boolean;
    fallbackStrategy: 'disable_embeddings' | 'disable_llm_normalization' | 'offline_mode' | 'none';
    errorMessage: string;
    recoveryActions: string[];
  } {
    const errorMessage = error.message || 'Unknown database error';
    const recoveryActions: string[] = [];
    let shouldRetry = false;
    let fallbackStrategy:
      | 'disable_embeddings'
      | 'disable_llm_normalization'
      | 'offline_mode'
      | 'none' = 'none';

    if (errorMessage.includes('connection') || errorMessage.includes('timeout')) {
      shouldRetry = true;
      fallbackStrategy = 'offline_mode';
      recoveryActions.push('Check database connectivity');
      recoveryActions.push('Verify DATABASE_URL environment variable');
    } else if (errorMessage.includes('embedding') || operation.includes('embedding')) {
      this.embeddingServiceAvailable = false;
      fallbackStrategy = 'disable_embeddings';
      recoveryActions.push('Continue with exact name matching only');
      recoveryActions.push('Check embedding service configuration');
    } else if (operation.includes('normalization')) {
      this.llmNormalizationEnabled = false;
      fallbackStrategy = 'disable_llm_normalization';
      recoveryActions.push('Use simple rule-based normalization');
      recoveryActions.push('Check LLM service availability');
    } else if (errorMessage.includes('table') || errorMessage.includes('column')) {
      fallbackStrategy = 'offline_mode';
      recoveryActions.push('Verify database schema is up to date');
      recoveryActions.push('Check table permissions');
    }

    console.warn(`Database service degradation in ${operation}:`, {
      error: errorMessage,
      fallbackStrategy,
      recoveryActions
    });

    return {
      shouldRetry,
      fallbackStrategy,
      errorMessage,
      recoveryActions
    };
  }

  /**
   * Health check for database connectivity
   * @returns Boolean indicating if database is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await db.execute(sql`SELECT 1 as test`);
      return result.length > 0;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Get database statistics for monitoring
   * @returns Statistics about the switches database
   */
  async getDatabaseStats(): Promise<{
    totalSwitches: number;
    manufacturers: number;
    switchTypes: string[];
    lastUpdated?: Date;
  }> {
    try {
      const [countResult, manufacturerResult, typesResult] = await Promise.all([
        db.execute<{ count: number }>(sql`SELECT COUNT(*) as count FROM ${switchesTable}`),
        db.execute<{ count: number }>(
          sql`SELECT COUNT(DISTINCT manufacturer) as count FROM ${switchesTable}`
        ),
        db.execute<{ type: string }>(
          sql`SELECT DISTINCT type FROM ${switchesTable} WHERE type IS NOT NULL`
        )
      ]);

      return {
        totalSwitches: countResult[0]?.count || 0,
        manufacturers: manufacturerResult[0]?.count || 0,
        switchTypes: typesResult.map((r) => r.type).filter(Boolean)
      };
    } catch (error) {
      console.error('Failed to get database stats:', error);
      return {
        totalSwitches: 0,
        manufacturers: 0,
        switchTypes: []
      };
    }
  }
}

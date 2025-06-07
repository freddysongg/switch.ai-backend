import { and, desc, eq, sql } from 'drizzle-orm';

import { AI_CONFIG } from '../config/ai.config.js';
import { arrayToVector, db, withDb } from '../db/index.js';
import {
  conversations,
  messages as messagesTable,
  switches as switchesTable
} from '../db/schema.js';
import { ChatRequest, ChatResponse, ChatMessage as UIChatMessage } from '../types/chat.js';
import { DatabaseSanitizer } from '../utils/databaseSanitizer.js';
import { fuseResults } from '../utils/hybridSearch.js';
import { DatabaseService } from './databaseService.js';
import { LocalEmbeddingService } from './embeddingsLocal.js';
import { GeminiService } from './gemini.js';
import { PromptBuilder } from './promptBuilder.js';
import { RerankService } from './rerankService.js';

interface SwitchContextForPrompt {
  [key: string]: unknown;
  name: string;
  manufacturer: string;
  type: string | null;
  spring: string | null;
  actuationForce: number | null;
  description_text?: string;
  similarity?: number;
}

interface ComparisonIntent {
  isComparison: boolean;
  confidence: number;
  extractedSwitchNames: string[];
  originalQuery: string;
}

interface ProcessedComparisonRequest {
  isValidComparison: boolean;
  switchesToCompare: string[];
  userFeedbackMessage?: string;
  confidence: number;
  originalQuery: string;
  processingNote?: string;
}

interface ComprehensiveSwitchData {
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
  isFound: boolean;
  missingFields: string[];
  matchConfidence?: number;
  originalQuery: string;
}

interface ComparisonDataRetrievalResult {
  switchesData: ComprehensiveSwitchData[];
  allSwitchesFound: boolean;
  missingSwitches: string[];
  hasDataGaps: boolean;
  retrievalNotes: string[];
}

const RRF_K = 60;
const TOP_N = 3;

export class ChatService {
  private embeddingService: LocalEmbeddingService | null = null;
  private geminiService: GeminiService | null = null;
  private databaseService: DatabaseService | null = null;
  private rerankService: RerankService | null = null;

  /**
   * Get or create the embedding service (lazy initialization)
   */
  private getEmbeddingService(): LocalEmbeddingService {
    if (!this.embeddingService) {
      this.embeddingService = new LocalEmbeddingService();
    }
    return this.embeddingService;
  }

  /**
   * Get or create the Gemini service (lazy initialization)
   */
  private getGeminiService(): GeminiService {
    if (!this.geminiService) {
      this.geminiService = new GeminiService();
    }
    return this.geminiService;
  }

  /**
   * Get or create the database service (lazy initialization)
   */
  private getDatabaseService(): DatabaseService {
    if (!this.databaseService) {
      this.databaseService = new DatabaseService();
    }
    return this.databaseService;
  }

  /**
   * Get or create the rerank service (lazy initialization)
   */
  private getRerankService(): RerankService {
    if (!this.rerankService) {
      this.rerankService = new RerankService();
    }
    return this.rerankService;
  }

  private truncateText(text: string, max: number): string {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const lastSpaceIndex = cut.lastIndexOf(' ');
    return (lastSpaceIndex > 0 ? cut.slice(0, lastSpaceIndex) : cut) + '...';
  }

  private async getConversationHistoryForPrompt(
    conversationId: string
  ): Promise<Pick<UIChatMessage, 'role' | 'content'>[]> {
    const dbMessages = await db
      .select({
        role: messagesTable.role,
        content: messagesTable.content
      })
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(desc(messagesTable.createdAt))
      .limit(AI_CONFIG.CHAT_HISTORY_MAX_TURNS * 2);

    return dbMessages.reverse().map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }));
  }

  /**
   * Detects if the user query is intended for switch comparison
   * Strategy combines keyword matching, pattern recognition, and switch name extraction
   */
  private async detectComparisonIntent(userQuery: string): Promise<ComparisonIntent> {
    const query = userQuery.toLowerCase().trim();
    let confidence = 0;
    let extractedSwitchNames: string[] = [];

    try {
      // Step 1: Look for explicit comparison keywords
      const comparisonKeywords = [
        'vs',
        'versus',
        'compare',
        'comparison',
        'difference',
        'differences',
        'better',
        'which is better',
        "what's the difference",
        'how do they compare',
        'contrast',
        'distinguish',
        'differentiate'
      ];

      const hasComparisonKeyword = comparisonKeywords.some((keyword) => query.includes(keyword));

      if (hasComparisonKeyword) {
        confidence += 0.4;
      }

      // Step 2: Use enhanced switch name extraction (with embedding service fallback handling)
      try {
        extractedSwitchNames = await this.parseAndExtractSwitchNames(userQuery);
      } catch (embeddingError) {
        console.warn(
          'Embedding service failed during switch name extraction, falling back to pattern-only extraction:',
          embeddingError
        );
        extractedSwitchNames = await this.extractPotentialSwitchNames(userQuery);
      }

      // Step 3: Look for "X vs Y" or "X versus Y" patterns (additional confidence boost)
      const vsPatterns = [
        /(\w[\w\s-]*?)\s+vs\s+(\w[\w\s-]*?)(?:\s|$|\?|\.)/gi,
        /(\w[\w\s-]*?)\s+versus\s+(\w[\w\s-]*?)(?:\s|$|\?|\.)/gi,
        /compare\s+(\w[\w\s-]*?)\s+(?:and|with|to)\s+(\w[\w\s-]*?)(?:\s|$|\?|\.)/gi,
        /difference\s+between\s+(\w[\w\s-]*?)\s+and\s+(\w[\w\s-]*?)(?:\s|$|\?|\.)/gi
      ];

      for (const pattern of vsPatterns) {
        const matches = [...query.matchAll(pattern)];
        if (matches.length > 0) {
          confidence += 0.3;
          break;
        }
      }

      // Step 4: Validate extracted switch names against database (with error handling)
      let validatedSwitches: string[] = [];
      try {
        validatedSwitches = await this.validateAndMatchSwitchNames(extractedSwitchNames);
      } catch (validationError) {
        console.warn(
          'Database validation failed during switch name validation, using extracted names as-is:',
          validationError
        );
        validatedSwitches = extractedSwitchNames;
        confidence = confidence * 0.8;
      }

      if (validatedSwitches.length >= 2) {
        confidence += 0.3;
      } else if (validatedSwitches.length === 1 && hasComparisonKeyword) {
        confidence += 0.1;
      }

      // Step 5: Additional heuristics
      const manufacturers = [
        'gateron',
        'cherry',
        'kailh',
        'akko',
        'jwk',
        'novelkeys',
        'zeal',
        'holy'
      ];
      const mentionedManufacturers = manufacturers.filter((mfg) => query.includes(mfg));
      if (mentionedManufacturers.length >= 2) {
        confidence += 0.1;
      }

      const switchTypes = ['linear', 'tactile', 'clicky', 'silent'];
      const mentionedTypes = switchTypes.filter((type) => query.includes(type));
      if (mentionedTypes.length >= 2) {
        confidence += 0.1;
      }

      const isComparison = confidence >= 0.5;

      return {
        isComparison,
        confidence,
        extractedSwitchNames: validatedSwitches,
        originalQuery: userQuery
      };
    } catch (criticalError) {
      console.error('Critical error in detectComparisonIntent:', criticalError);
      const comparisonKeywords = ['vs', 'versus', 'compare', 'comparison', 'difference', 'better'];
      const hasKeyword = comparisonKeywords.some((keyword) => query.includes(keyword));

      return {
        isComparison: hasKeyword,
        confidence: hasKeyword ? 0.3 : 0,
        extractedSwitchNames: [],
        originalQuery: userQuery
      };
    }
  }

  /**
   * Extracts potential switch names from the query using heuristics
   */
  private async extractPotentialSwitchNames(query: string): Promise<string[]> {
    const potential: string[] = [];

    const switchPatterns = [
      /(?:gateron|cherry|kailh|akko|jwk|novelkeys|zeal|holy)\s+[\w\s-]+/gi,
      /(?:red|blue|brown|black|green|yellow|white|silver|gold|pink|purple|orange)\s*(?:switch|switches)?/gi,
      /(?:cream|ink|oil\s*king|banana\s*split|alpaca|tangerine|lavender|silent|tactile|linear|clicky)/gi
    ];

    for (const pattern of switchPatterns) {
      const matches = [...query.matchAll(pattern)];
      for (const match of matches) {
        const candidate = match[0].trim().replace(/\s*switches?\s*$/i, '');
        if (candidate.length > 2) {
          potential.push(candidate);
        }
      }
    }

    return [...new Set(potential)];
  }

  /**
   * Enhanced switch name parsing and extraction logic
   * Handles multiple query formats and extraction strategies
   */
  private async parseAndExtractSwitchNames(userQuery: string): Promise<string[]> {
    const query = userQuery.toLowerCase().trim();
    const extractedNames: string[] = [];

    // Strategy 1: Direct pattern matching for common comparison formats
    const directPatterns = [
      // "X vs Y" patterns
      /(\w[\w\s-]*?)\s+(?:vs|versus)\s+(\w[\w\s-]*?)(?:\s|$|\?|\.|,)/gi,
      // "compare X and Y" patterns
      /compare\s+(\w[\w\s-]*?)\s+(?:and|with|to)\s+(\w[\w\s-]*?)(?:\s|$|\?|\.|,)/gi,
      // "difference between X and Y" patterns
      /difference\s+between\s+(\w[\w\s-]*?)\s+and\s+(\w[\w\s-]*?)(?:\s|$|\?|\.|,)/gi,
      // "X or Y" patterns (when comparison keywords are present)
      /(\w[\w\s-]*?)\s+or\s+(\w[\w\s-]*?)(?:\s|$|\?|\.|,)/gi
    ];

    for (const pattern of directPatterns) {
      const matches = [...query.matchAll(pattern)];
      for (const match of matches) {
        if (match[1] && match[2]) {
          extractedNames.push(match[1].trim(), match[2].trim());
        }
      }
    }

    // Strategy 2: Enhanced brand-based extraction
    const brandPatterns = [
      // Comprehensive brand patterns with multiple name formats
      /(?:gateron)\s+([\w\s-]+?)(?:\s+switch|\s*$|\s*[,.\?])/gi,
      /(?:cherry)\s+mx\s+([\w\s-]+?)(?:\s+switch|\s*$|\s*[,.\?])/gi,
      /(?:cherry)\s+([\w\s-]+?)(?:\s+switch|\s*$|\s*[,.\?])/gi,
      /(?:kailh)\s+([\w\s-]+?)(?:\s+switch|\s*$|\s*[,.\?])/gi,
      /(?:akko)\s+([\w\s-]+?)(?:\s+switch|\s*$|\s*[,.\?])/gi,
      /(?:jwk|durock)\s+([\w\s-]+?)(?:\s+switch|\s*$|\s*[,.\?])/gi,
      /(?:novelkeys|novel\s*keys)\s+([\w\s-]+?)(?:\s+switch|\s*$|\s*[,.\?])/gi,
      /(?:zeal|zealios)\s+([\w\s-]+?)(?:\s+switch|\s*$|\s*[,.\?])/gi,
      /(?:holy)\s+([\w\s-]+?)(?:\s+switch|\s*$|\s*[,.\?])/gi
    ];

    for (const pattern of brandPatterns) {
      const matches = [...query.matchAll(pattern)];
      for (const match of matches) {
        if (match[1]) {
          const fullName = match[0].replace(/\s+switch$/i, '').trim();
          extractedNames.push(fullName);
        }
      }
    }

    // Strategy 3: Common switch name recognition (exact matches)
    const commonSwitches = [
      // Popular linear switches
      'gateron oil king',
      'gateron ink black',
      'gateron yellow',
      'gateron red',
      'gateron black',
      'cherry mx red',
      'cherry mx black',
      'cherry mx silver',
      'cherry mx speed silver',
      'kailh red',
      'kailh black',
      'kailh speed silver',
      'akko cs rose red',
      'akko cs wine red',
      'akko cs silver',
      'jwk alpaca',
      'jwk banana split',
      'jwk lavender',
      'novelkeys cream',
      'novelkeys silk yellow',
      'novelkeys dry yellow',

      // Popular tactile switches
      'cherry mx brown',
      'cherry mx clear',
      'gateron brown',
      'gateron g pro brown',
      'kailh brown',
      'kailh pro purple',
      'akko cs lavender purple',
      'akko cs ocean blue',
      'holy panda',
      'glorious panda',
      'zealios v2',
      'zilents v2',
      'durock t1',
      'durock medium tactile',

      // Popular clicky switches
      'cherry mx blue',
      'cherry mx green',
      'gateron blue',
      'gateron green',
      'kailh blue',
      'kailh white',
      'kailh pink',
      'novelkeys sherbet'
    ];

    for (const switchName of commonSwitches) {
      if (query.includes(switchName)) {
        extractedNames.push(switchName);
      }
    }

    // Strategy 4: Color-based switch extraction with context
    const colorPatterns = [
      /(?:gateron|cherry|kailh|akko)\s+(red|blue|brown|black|green|yellow|white|silver|gold|pink|purple|orange|clear)(?:\s+switch|\s*$|\s*[,.\?])/gi,
      /(red|blue|brown|black|green|yellow|white|silver|gold|pink|purple|orange|clear)\s+(?:switch|linear|tactile|clicky)(?:\s*$|\s*[,.\?])/gi
    ];

    for (const pattern of colorPatterns) {
      const matches = [...query.matchAll(pattern)];
      for (const match of matches) {
        extractedNames.push(match[0].replace(/\s+switch$/i, '').trim());
      }
    }

    // Strategy 5: Handle quoted or explicitly mentioned switches
    const quotedSwitches = query.match(/"([^"]+)"/g) || query.match(/'([^']+)'/g);
    if (quotedSwitches) {
      for (const quoted of quotedSwitches) {
        const cleaned = quoted.replace(/['"]/g, '').trim();
        if (cleaned.length > 2) {
          extractedNames.push(cleaned);
        }
      }
    }

    // Strategy 6: List detection (switches separated by commas, "and", etc.)
    if (query.includes(',') || query.includes(' and ')) {
      const listItems = query
        .split(/,|\s+and\s+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 2)
        .filter((item) => {
          const switchIndicators = [
            'switch',
            'linear',
            'tactile',
            'clicky',
            'mx',
            'gateron',
            'cherry',
            'kailh'
          ];
          return (
            switchIndicators.some((indicator) => item.includes(indicator)) ||
            /^[a-z\s-]+$/.test(item)
          );
        });

      extractedNames.push(...listItems);
    }

    const cleanedNames = extractedNames
      .map((name) => name.trim())
      .filter((name) => name.length > 2)
      .filter((name) => !['switch', 'switches', 'linear', 'tactile', 'clicky'].includes(name))
      .map((name) => name.replace(/\s*switches?\s*$/i, ''))
      .filter((name, index, array) => array.indexOf(name) === index);

    return cleanedNames;
  }

  /**
   * Validates potential switch names against the database
   */
  private async validateSwitchNames(potentialNames: string[]): Promise<string[]> {
    if (potentialNames.length === 0) return [];

    const validated: string[] = [];

    for (const name of potentialNames) {
      const cleanName = name.trim();
      if (cleanName.length < 2) continue;

      const results = await db
        .select({ name: switchesTable.name })
        .from(switchesTable)
        .where(sql`LOWER(${switchesTable.name}) LIKE ${'%' + cleanName.toLowerCase() + '%'}`)
        .limit(1);

      if (results.length > 0) {
        validated.push(results[0].name);
      }
    }

    return [...new Set(validated)];
  }

  /**
   * Enhanced validation of potential switch names against the database
   * Uses multiple matching strategies for better accuracy
   */
  private async validateAndMatchSwitchNames(potentialNames: string[]): Promise<string[]> {
    if (potentialNames.length === 0) return [];

    const validated: string[] = [];

    for (const name of potentialNames) {
      const cleanName = name.trim().toLowerCase();
      if (cleanName.length < 2) continue;

      // Strategy 1: Exact match (case insensitive)
      let results = await db
        .select({ name: switchesTable.name })
        .from(switchesTable)
        .where(sql`LOWER(${switchesTable.name}) = ${cleanName}`)
        .limit(1);

      if (results.length > 0) {
        validated.push(results[0].name);
        continue;
      }

      // Strategy 2: Contains match (case insensitive)
      results = await db
        .select({ name: switchesTable.name })
        .from(switchesTable)
        .where(sql`LOWER(${switchesTable.name}) LIKE ${'%' + cleanName + '%'}`)
        .limit(3);

      if (results.length > 0) {
        const bestMatch = results.reduce((best, current) =>
          current.name.length < best.name.length ? current : best
        );
        validated.push(bestMatch.name);
        continue;
      }

      // Strategy 3: Word-based matching for compound names
      const words = cleanName.split(/\s+/).filter((word) => word.length > 2);
      if (words.length > 1) {
        const wordConditions = words.map(
          (word) => sql`LOWER(${switchesTable.name}) LIKE ${'%' + word + '%'}`
        );

        results = await db
          .select({ name: switchesTable.name })
          .from(switchesTable)
          .where(
            sql`${wordConditions.reduce((acc, condition, index) =>
              index === 0 ? condition : sql`${acc} AND ${condition}`
            )}`
          )
          .limit(2);

        if (results.length > 0) {
          validated.push(results[0].name);
          continue;
        }
      }

      // Strategy 4: Brand + partial name matching
      const brandMappings = {
        gateron: ['gateron'],
        cherry: ['cherry mx', 'cherry'],
        kailh: ['kailh'],
        akko: ['akko cs', 'akko'],
        jwk: ['jwk', 'durock'],
        novelkeys: ['novelkeys', 'nk'],
        zeal: ['zealios', 'zilents', 'zeal'],
        holy: ['holy panda']
      };

      for (const [brand, dbPrefixes] of Object.entries(brandMappings)) {
        if (cleanName.includes(brand)) {
          for (const prefix of dbPrefixes) {
            results = await db
              .select({ name: switchesTable.name })
              .from(switchesTable)
              .where(sql`LOWER(${switchesTable.name}) LIKE ${prefix.toLowerCase() + '%'}`)
              .limit(5);

            if (results.length > 0) {
              const bestMatch =
                results.find((result) => {
                  const resultLower = result.name.toLowerCase();
                  return words.some((word) => resultLower.includes(word));
                }) || results[0];

              validated.push(bestMatch.name);
              break;
            }
          }
          if (validated.length > 0) break;
        }
      }
    }

    return [...new Set(validated)];
  }

  /**
   * Processes comparison requests based on number of identified switches
   * Handles optimal case (2-3 switches) and provides graceful degradation
   */
  private async processVariableSwitchComparison(
    comparisonIntent: ComparisonIntent
  ): Promise<ProcessedComparisonRequest> {
    const { isComparison, extractedSwitchNames, confidence, originalQuery } = comparisonIntent;
    const switchCount = extractedSwitchNames.length;

    // Case 1: Not a comparison or no switches found
    if (!isComparison || switchCount === 0) {
      return {
        isValidComparison: false,
        switchesToCompare: [],
        confidence,
        originalQuery,
        userFeedbackMessage:
          switchCount === 0 && isComparison
            ? "I detected you want to compare switches, but I couldn't identify specific switch names in your query. Could you please mention the exact switch names you'd like to compare?"
            : undefined
      };
    }

    // Case 2: Only one switch identified
    if (switchCount === 1) {
      return {
        isValidComparison: false,
        switchesToCompare: extractedSwitchNames,
        confidence,
        originalQuery,
        userFeedbackMessage: `I found "${extractedSwitchNames[0]}" in your query. For a comparison, I need at least two switches. Would you like to specify another switch to compare it with, or would you prefer general information about ${extractedSwitchNames[0]}?`
      };
    }

    // Case 3: Optimal range (2-3 switches) - Perfect for comparison
    if (switchCount >= 2 && switchCount <= 3) {
      return {
        isValidComparison: true,
        switchesToCompare: extractedSwitchNames,
        confidence,
        originalQuery,
        processingNote: `Optimal comparison setup with ${switchCount} switches: ${extractedSwitchNames.join(', ')}`
      };
    }

    // Case 4: Too many switches (4+) - Apply intelligent filtering
    if (switchCount >= 4) {
      const filteredSwitches = await this.intelligentSwitchFiltering(
        extractedSwitchNames,
        originalQuery
      );

      return {
        isValidComparison: true,
        switchesToCompare: filteredSwitches,
        confidence: confidence * 0.9,
        originalQuery,
        userFeedbackMessage: `I found ${switchCount} switches in your query (${extractedSwitchNames.join(', ')}). For the best comparison experience, I'll focus on the most relevant ${filteredSwitches.length}: ${filteredSwitches.join(', ')}. If you'd prefer a different selection, please let me know!`,
        processingNote: `Filtered from ${switchCount} to ${filteredSwitches.length} switches for optimal comparison`
      };
    }

    return {
      isValidComparison: false,
      switchesToCompare: extractedSwitchNames,
      confidence,
      originalQuery,
      userFeedbackMessage:
        'I encountered an unexpected issue processing your comparison request. Please try rephrasing your query.'
    };
  }

  /**
   * Intelligent filtering for when too many switches are identified
   * Prioritizes based on query context, switch popularity, and diversity
   */
  private async intelligentSwitchFiltering(
    allSwitches: string[],
    originalQuery: string
  ): Promise<string[]> {
    const targetCount = 3;

    if (allSwitches.length <= targetCount) {
      return allSwitches;
    }

    // Strategy 1: Priority scoring based on multiple factors
    const scoredSwitches = await Promise.all(
      allSwitches.map(async (switchName) => {
        let score = 0;
        const lowerQuery = originalQuery.toLowerCase();
        const lowerSwitch = switchName.toLowerCase();

        // Factor 1: Position in query (earlier mentioned = higher priority)
        const position = lowerQuery.indexOf(lowerSwitch);
        if (position !== -1) {
          score += (1000 - position) / 10;
        }

        // Factor 2: Explicit mention context (vs, compare, etc.)
        const comparisonContext = [
          `${lowerSwitch} vs`,
          `${lowerSwitch} versus`,
          `compare ${lowerSwitch}`,
          `${lowerSwitch} or`,
          `${lowerSwitch} and`,
          `between ${lowerSwitch}`
        ];
        if (comparisonContext.some((pattern) => lowerQuery.includes(pattern))) {
          score += 50;
        }

        // Factor 3: Switch type diversity bonus
        const switchData = await db
          .select({ type: switchesTable.type, manufacturer: switchesTable.manufacturer })
          .from(switchesTable)
          .where(eq(switchesTable.name, switchName))
          .limit(1);

        if (switchData.length > 0) {
          score += 10;
        }

        return { switchName, score };
      })
    );

    // Strategy 2: Ensure type diversity if possible
    const typeGroups = {
      linear: [] as string[],
      tactile: [] as string[],
      clicky: [] as string[]
    };

    for (const { switchName } of scoredSwitches) {
      const switchData = await db
        .select({ type: switchesTable.type })
        .from(switchesTable)
        .where(eq(switchesTable.name, switchName))
        .limit(1);

      if (switchData.length > 0 && switchData[0].type) {
        const type = switchData[0].type.toLowerCase();
        if (type.includes('linear')) {
          typeGroups.linear.push(switchName);
        } else if (type.includes('tactile')) {
          typeGroups.tactile.push(switchName);
        } else if (type.includes('clicky')) {
          typeGroups.clicky.push(switchName);
        }
      }
    }

    // Strategy 3: Smart selection with diversity
    const selected: string[] = [];
    const sortedSwitches = scoredSwitches.sort((a, b) => b.score - a.score);

    const typeOrder = ['linear', 'tactile', 'clicky'] as const;
    for (const type of typeOrder) {
      if (typeGroups[type].length > 0 && selected.length < targetCount) {
        const bestOfType = sortedSwitches.find(
          (s) => typeGroups[type].includes(s.switchName) && !selected.includes(s.switchName)
        );
        if (bestOfType) {
          selected.push(bestOfType.switchName);
        }
      }
    }

    for (const { switchName } of sortedSwitches) {
      if (selected.length >= targetCount) break;
      if (!selected.includes(switchName)) {
        selected.push(switchName);
      }
    }

    return selected.slice(0, targetCount);
  }

  /**
   * Public method to process comparison queries
   * Integrates comparison detection and variable switch handling
   */
  async processComparisonQuery(userQuery: string): Promise<ProcessedComparisonRequest> {
    // Step 1: Detect comparison intent and extract switches
    const comparisonIntent = await this.detectComparisonIntent(userQuery);

    // Step 2: Process the variable number of switches
    const processedRequest = await this.processVariableSwitchComparison(comparisonIntent);

    return processedRequest;
  }

  /**
   * Specialized data retrieval for switch comparisons
   * Fetches complete records for each identified switch instead of using general RAG
   */
  private async retrieveComprehensiveSwitchData(
    switchNames: string[]
  ): Promise<ComparisonDataRetrievalResult> {
    const switchesData: ComprehensiveSwitchData[] = [];
    const missingSwitches: string[] = [];
    const retrievalNotes: string[] = [];

    if (switchNames.length === 0) {
      return {
        switchesData: [],
        allSwitchesFound: false,
        missingSwitches: [],
        hasDataGaps: false,
        retrievalNotes: ['No switch names provided for retrieval']
      };
    }

    let embeddingServiceAvailable = true;
    let databaseAvailable = true;

    for (const switchName of switchNames) {
      try {
        let matchResults: any[] = [];
        let matchConfidence = 0;

        // Strategy 1: Try embedding-based matching if service is available
        if (embeddingServiceAvailable) {
          try {
            const switchEmbedding = await this.getEmbeddingService().embedText(switchName);
            const switchEmbeddingSql = arrayToVector(switchEmbedding);

            matchResults = await db.execute<{
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

            if (matchResults.length > 0) {
              matchConfidence = matchResults[0].similarity;
            }
          } catch (embeddingError) {
            console.warn(
              `Embedding service failed for switch "${switchName}", falling back to direct matching:`,
              embeddingError
            );
            embeddingServiceAvailable = false;
          }
        }

        // Strategy 2: Fallback to direct name matching if embedding failed
        if (!embeddingServiceAvailable || matchResults.length === 0) {
          try {
            matchResults = await db.execute<{
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
                  WHEN LOWER(s.name) = LOWER(${switchName}) THEN 1.0
                  WHEN LOWER(s.name) LIKE LOWER(${'%' + switchName + '%'}) THEN 0.8
                  ELSE 0.6
                END AS similarity
              FROM ${switchesTable} AS s
              WHERE LOWER(s.name) LIKE LOWER(${'%' + switchName + '%'})
              ORDER BY similarity DESC
              LIMIT 1
            `);

            if (matchResults.length > 0) {
              matchConfidence = matchResults[0].similarity;
              retrievalNotes.push(
                `Used direct name matching for "${switchName}" (embedding service unavailable)`
              );
            }
          } catch (dbError) {
            console.error(`Database query failed for switch "${switchName}":`, dbError);
            databaseAvailable = false;
          }
        }

        if (!databaseAvailable || matchResults.length === 0) {
          missingSwitches.push(switchName);
          switchesData.push({
            name: switchName,
            manufacturer: '',
            type: null,
            topHousing: null,
            bottomHousing: null,
            stem: null,
            mount: null,
            spring: null,
            actuationForce: null,
            bottomForce: null,
            preTravel: null,
            totalTravel: null,
            isFound: false,
            missingFields: ['all'],
            matchConfidence: 0,
            originalQuery: switchName
          });

          if (!databaseAvailable) {
            retrievalNotes.push(`Database unavailable for switch "${switchName}"`);
          } else {
            retrievalNotes.push(`No matches found in database for "${switchName}"`);
          }
          continue;
        }

        const bestMatch = matchResults[0];

        const confidenceThreshold = 0.5;
        if (matchConfidence < confidenceThreshold) {
          missingSwitches.push(switchName);
          switchesData.push({
            name: switchName,
            manufacturer: '',
            type: null,
            topHousing: null,
            bottomHousing: null,
            stem: null,
            mount: null,
            spring: null,
            actuationForce: null,
            bottomForce: null,
            preTravel: null,
            totalTravel: null,
            isFound: false,
            missingFields: ['all'],
            matchConfidence,
            originalQuery: switchName
          });
          retrievalNotes.push(
            `Low confidence match for "${switchName}" (best match: "${bestMatch.name}" with ${(matchConfidence * 100).toFixed(1)}% confidence)`
          );
          continue;
        }

        const missingFields: string[] = [];
        const requiredFields = [
          'manufacturer',
          'type',
          'topHousing',
          'bottomHousing',
          'stem',
          'mount',
          'spring',
          'actuationForce',
          'bottomForce',
          'preTravel',
          'totalTravel'
        ];

        for (const field of requiredFields) {
          const value = bestMatch[field as keyof typeof bestMatch];
          if (value === null || value === undefined || value === '') {
            missingFields.push(field);
          }
        }

        switchesData.push({
          name: bestMatch.name,
          manufacturer: bestMatch.manufacturer,
          type: bestMatch.type,
          topHousing: bestMatch.topHousing,
          bottomHousing: bestMatch.bottomHousing,
          stem: bestMatch.stem,
          mount: bestMatch.mount,
          spring: bestMatch.spring,
          actuationForce: bestMatch.actuationForce,
          bottomForce: bestMatch.bottomForce,
          preTravel: bestMatch.preTravel,
          totalTravel: bestMatch.totalTravel,
          isFound: true,
          missingFields,
          matchConfidence,
          originalQuery: switchName
        });

        const confidencePercent = (matchConfidence * 100).toFixed(1);
        const matchType = embeddingServiceAvailable ? 'embedding' : 'direct name';
        if (bestMatch.name.toLowerCase() === switchName.toLowerCase()) {
          retrievalNotes.push(`Exact match found for "${switchName}" using ${matchType} matching`);
        } else {
          retrievalNotes.push(
            `Matched "${switchName}" to "${bestMatch.name}" using ${matchType} matching (${confidencePercent}% confidence)${
              missingFields.length > 0
                ? ` - missing data for: ${missingFields.join(', ')}`
                : ' with complete data'
            }`
          );
        }
      } catch (criticalError) {
        console.error(`Critical error retrieving data for switch "${switchName}":`, criticalError);
        missingSwitches.push(switchName);
        switchesData.push({
          name: switchName,
          manufacturer: '',
          type: null,
          topHousing: null,
          bottomHousing: null,
          stem: null,
          mount: null,
          spring: null,
          actuationForce: null,
          bottomForce: null,
          preTravel: null,
          totalTravel: null,
          isFound: false,
          missingFields: ['all'],
          matchConfidence: 0,
          originalQuery: switchName
        });
        retrievalNotes.push(
          `Critical error retrieving data for switch "${switchName}": ${criticalError instanceof Error ? criticalError.message : 'Unknown error'}`
        );
      }
    }

    const allSwitchesFound = missingSwitches.length === 0;
    const hasDataGaps = switchesData.some((s) => s.missingFields.length > 0);

    if (!embeddingServiceAvailable) {
      retrievalNotes.unshift(
        'Note: Embedding service was unavailable, used direct name matching as fallback'
      );
    }
    if (!databaseAvailable) {
      retrievalNotes.unshift('Warning: Database connection issues detected during retrieval');
    }

    return {
      switchesData,
      allSwitchesFound,
      missingSwitches,
      hasDataGaps,
      retrievalNotes
    };
  }

  /**
   * Formats missing data information for prompt building stage
   * Provides structured information about missing switches and null fields
   */
  private formatMissingDataForPrompt(retrievalResult: ComparisonDataRetrievalResult): {
    missingDataSummary: string;
    switchDataBlocks: string[];
    hasIncompleteData: boolean;
    promptInstructions: string;
  } {
    const { switchesData, allSwitchesFound, missingSwitches, hasDataGaps } = retrievalResult;

    const switchDataBlocks: string[] = [];
    const sanitizationLogs: any[] = [];

    for (const switchData of switchesData) {
      if (switchData.isFound) {
        let dataBlock = `SWITCH_NAME: ${switchData.name}\n`;
        dataBlock += `MANUFACTURER: ${switchData.manufacturer || 'N/A'}\n`;
        dataBlock += `TYPE: ${switchData.type || 'N/A'}\n`;
        dataBlock += `TOP_HOUSING: ${switchData.topHousing || 'N/A'}\n`;
        dataBlock += `BOTTOM_HOUSING: ${switchData.bottomHousing || 'N/A'}\n`;
        dataBlock += `STEM: ${switchData.stem || 'N/A'}\n`;
        dataBlock += `MOUNT: ${switchData.mount || 'N/A'}\n`;
        dataBlock += `SPRING: ${switchData.spring || 'N/A'}\n`;
        dataBlock += `ACTUATION_FORCE_G: ${switchData.actuationForce !== null ? switchData.actuationForce : 'N/A'}\n`;
        dataBlock += `BOTTOM_OUT_FORCE_G: ${switchData.bottomForce !== null ? switchData.bottomForce : 'N/A'}\n`;
        dataBlock += `PRE_TRAVEL_MM: ${switchData.preTravel !== null ? switchData.preTravel : 'N/A'}\n`;
        dataBlock += `TOTAL_TRAVEL_MM: ${switchData.totalTravel !== null ? switchData.totalTravel : 'N/A'}\n`;

        if (switchData.matchConfidence && switchData.matchConfidence < 1.0) {
          dataBlock += `MATCH_CONFIDENCE: ${(switchData.matchConfidence * 100).toFixed(1)}% (matched "${switchData.originalQuery}" to "${switchData.name}")\n`;
        }

        if (switchData.missingFields.length > 0) {
          dataBlock += `MISSING_FIELDS_NOTE: Data not available for: ${switchData.missingFields.join(', ')}\n`;
        }

        const sanitizationResult = DatabaseSanitizer.sanitizeString(dataBlock);
        if (sanitizationResult.wasModified) {
          sanitizationLogs.push(sanitizationResult);
        }

        switchDataBlocks.push(sanitizationResult.sanitizedContent);
      } else {
        const notFoundBlock =
          `SWITCH_NAME: ${switchData.originalQuery}\n` +
          `STATUS: NOT_FOUND_IN_DATABASE\n` +
          `NOTE: This switch was not found in our database. Use general knowledge for analysis.\n`;

        const sanitizationResult = DatabaseSanitizer.sanitizeString(notFoundBlock);
        if (sanitizationResult.wasModified) {
          sanitizationLogs.push(sanitizationResult);
        }

        switchDataBlocks.push(sanitizationResult.sanitizedContent);
      }
    }

    if (sanitizationLogs.length > 0) {
      DatabaseSanitizer.logSanitization('CHAT_SERVICE_SWITCH_DATA_BLOCKS', sanitizationLogs);
    }

    let missingDataSummary = '';
    if (missingSwitches.length > 0) {
      missingDataSummary += `Missing switches (not in database): ${missingSwitches.join(', ')}. `;
    }

    const switchesWithMissingFields = switchesData.filter(
      (s) => s.isFound && s.missingFields.length > 0
    );
    if (switchesWithMissingFields.length > 0) {
      missingDataSummary += `Switches with incomplete data: ${switchesWithMissingFields
        .map((s) => `${s.name} (missing: ${s.missingFields.join(', ')})`)
        .join('; ')}. `;
    }

    let promptInstructions = '';
    if (!allSwitchesFound || hasDataGaps) {
      promptInstructions = 'MISSING_SWITCH_DATA_NOTE: ';

      if (missingSwitches.length > 0) {
        promptInstructions += `${missingSwitches.join(', ')} not found in database - use general knowledge if available and clearly indicate sources. `;
      }

      if (hasDataGaps) {
        promptInstructions +=
          'Some switches have incomplete database records - mark missing specifications as "N/A" in technical specifications and note in analysis where general knowledge is used.';
      }
    }

    return {
      missingDataSummary: missingDataSummary.trim(),
      switchDataBlocks,
      hasIncompleteData: !allSwitchesFound || hasDataGaps,
      promptInstructions: promptInstructions.trim()
    };
  }

  /**
   * Transforms raw user query using LLM to optimize it for semantic search
   * Part of the LLM-Powered Query Transformation feature
   */
  private async transformQuery(rawQuery: string): Promise<string> {
    const transformationPrompt = `Rewrite the following user query to be optimal for a semantic search system for mechanical keyboard switches. Your goal is to expand concepts, add synonyms, and clarify intent. For example, if the user asks for 'quiet clicky switch', you could transform it to 'A quiet but tactile and clicky mechanical keyboard switch, possibly using a muted click mechanism or a specifically designed silent click switch.' Do not answer the query, only rewrite it.

User Query: <user_query>${rawQuery}</user_query>`;

    try {
      const transformedQuery = await this.getGeminiService().generate(transformationPrompt);
      return transformedQuery.trim();
    } catch (error) {
      console.warn('Query transformation failed, falling back to original query:', error);
      return rawQuery;
    }
  }

  /**
   * Standard RAG processing with Hybrid Search (Phase 2 Enhancement)
   * Combines semantic search and keyword search using Reciprocal Rank Fusion
   * Returns both the assistant text and switch information with re-ranking scores
   */
  private async processStandardRAG(
    rawUserQuery: string,
    currentConversationId: string
  ): Promise<{
    assistantText: string;
    switchesWithRelevance: Array<{
      name: string;
      manufacturer: string;
      type: string | null;
      relevance_score?: number;
      justification?: string;
    }>;
  }> {
    try {
      const transformedQuery = await this.transformQuery(rawUserQuery);
      console.log(`Query transformation: "${rawUserQuery}" → "${transformedQuery}"`);

      const [semanticResults, keywordResults] = await Promise.all([
        this.performSemanticSearch(transformedQuery),
        this.getDatabaseService().keywordSearch(rawUserQuery)
      ]);

      console.log(
        `Search results: ${semanticResults.length} semantic, ${keywordResults.length} keyword`
      );

      const fusedResults = fuseResults(semanticResults, keywordResults, RRF_K);

      const topNResults = fusedResults.slice(0, TOP_N);

      console.log(
        `Hybrid search: ${fusedResults.length} fused results, using top ${topNResults.length}`
      );

      let rerankedContexts: SwitchContextForPrompt[] = [];
      let switchesWithRelevance: Array<{
        name: string;
        manufacturer: string;
        type: string | null;
        relevance_score?: number;
        justification?: string;
      }> = [];

      if (topNResults.length > 0) {
        try {
          const contextsForReranking = topNResults.map((result) => ({
            name: result.name,
            manufacturer: result.manufacturer,
            type: result.type,
            spring: result.spring,
            actuationForce: result.actuationForce,
            description_text: this.buildSwitchDescription(result),
            similarity: result.rrfScore
          }));

          const rerankedItems = await this.getRerankService().rerankContexts(
            rawUserQuery,
            contextsForReranking
          );

          const rerankScoreMap = new Map(rerankedItems.map((item) => [item.item_id, item]));

          const reorderedResults = topNResults
            .map((result) => {
              const rerankInfo = rerankScoreMap.get(result.name);
              return {
                ...result,
                llmRelevanceScore: rerankInfo?.relevance_score || result.rrfScore,
                llmJustification: rerankInfo?.justification
              };
            })
            .sort((a, b) => (b.llmRelevanceScore || 0) - (a.llmRelevanceScore || 0));

          rerankedContexts = reorderedResults.map((result) => ({
            name: result.name,
            manufacturer: result.manufacturer,
            type: result.type,
            spring: result.spring,
            actuationForce: result.actuationForce,
            description_text: this.buildSwitchDescription(result),
            similarity: result.llmRelevanceScore || result.rrfScore
          }));

          switchesWithRelevance = reorderedResults.map((result) => ({
            name: result.name,
            manufacturer: result.manufacturer,
            type: result.type,
            relevance_score: result.llmRelevanceScore,
            justification: result.llmJustification
          }));

          console.log(
            `Re-ranking complete: ${rerankedContexts.length} contexts reordered by LLM relevance`
          );
        } catch (rerankError) {
          console.warn('Re-ranking failed, using original hybrid search order:', rerankError);

          rerankedContexts = topNResults.map((result) => ({
            name: result.name,
            manufacturer: result.manufacturer,
            type: result.type,
            spring: result.spring,
            actuationForce: result.actuationForce,
            description_text: this.buildSwitchDescription(result),
            similarity: result.rrfScore
          }));

          switchesWithRelevance = topNResults.map((result) => ({
            name: result.name,
            manufacturer: result.manufacturer,
            type: result.type,
            relevance_score: result.rrfScore
          }));
        }
      }

      const switchContextsForPrompt: SwitchContextForPrompt[] = rerankedContexts;

      if (switchContextsForPrompt.length === 0) {
        try {
          const fallbackPrompt = AI_CONFIG.GENERAL_KNOWLEDGE_FALLBACK_PROMPT(rawUserQuery);
          const assistantText = await this.getGeminiService().generate(fallbackPrompt);
          return {
            assistantText,
            switchesWithRelevance: []
          };
        } catch (error) {
          console.warn(
            'GeminiService failed during General Knowledge Fallback, using hardcoded fallback:',
            error
          );

          const randomIndex = Math.floor(
            Math.random() * AI_CONFIG.HARDCODED_FALLBACK_MESSAGES.length
          );
          return {
            assistantText: AI_CONFIG.HARDCODED_FALLBACK_MESSAGES[randomIndex],
            switchesWithRelevance: []
          };
        }
      }

      const historyForPrompt = await this.getConversationHistoryForPrompt(currentConversationId);

      const prompt = PromptBuilder.buildPrompt(
        historyForPrompt,
        switchContextsForPrompt,
        rawUserQuery
      );

      const assistantText = await this.getGeminiService().generate(prompt);

      return {
        assistantText,
        switchesWithRelevance
      };
    } catch (error) {
      console.error('Hybrid search failed, falling back to basic semantic search:', error);

      const fallbackResult = await this.fallbackToBasicSemanticSearch(
        rawUserQuery,
        currentConversationId
      );
      return {
        assistantText: fallbackResult,
        switchesWithRelevance: []
      };
    }
  }

  /**
   * Performs semantic search using embeddings
   */
  private async performSemanticSearch(query: string): Promise<any[]> {
    const queryEmbedding = await this.getEmbeddingService().embedText(query);
    const queryEmbeddingSql = arrayToVector(queryEmbedding);

    const results = await db.execute<{
      id: string;
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
      embedding: any;
      similarity: number;
    }>(sql`
      SELECT 
        s.id,
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
        s.embedding,
        1 - ((s.embedding::text)::vector <=> ${queryEmbeddingSql}) AS similarity
      FROM ${switchesTable} AS s
      ORDER BY similarity DESC
      LIMIT ${AI_CONFIG.CONTEXT_RESULTS_COUNT}
    `);

    return results.filter((r) => r.similarity >= AI_CONFIG.SIMILARITY_THRESHOLD);
  }

  /**
   * Builds a description text for a switch result
   */
  private buildSwitchDescription(switchData: any): string {
    return (
      `${switchData.name} is a ${switchData.type || 'N/A'} switch by ${switchData.manufacturer}. ` +
      `It has a spring type of ${switchData.spring || 'N/A'} and an actuation force of ${switchData.actuationForce || 'N/A'}g. ` +
      `Top housing: ${switchData.topHousing || 'N/A'}, Bottom housing: ${switchData.bottomHousing || 'N/A'}, Stem: ${switchData.stem || 'N/A'}.`
    );
  }

  /**
   * Fallback to basic semantic search if hybrid search fails
   */
  private async fallbackToBasicSemanticSearch(
    rawUserQuery: string,
    currentConversationId: string
  ): Promise<string> {
    // Original semantic search logic
    const queryEmbedding = await this.getEmbeddingService().embedText(rawUserQuery);
    const queryEmbeddingSql = arrayToVector(queryEmbedding);

    const retrievedRawContexts = await db.execute<
      SwitchContextForPrompt & { similarity: number }
    >(sql`
      SELECT 
        s.name, 
        s.manufacturer, 
        s.type,
        s.spring,
        s.actuation_force as "actuationForce",
        (s.name || ' is a ' || COALESCE(s.type, 'N/A') || ' switch by ' || s.manufacturer || 
         '. It has a spring type of ' || COALESCE(s.spring, 'N/A') || 
         ' and an actuation force of ' || COALESCE(CAST(s.actuation_force AS TEXT), 'N/A') || 'g.' ||
         ' Top housing: ' || COALESCE(s.top_housing, 'N/A') || ', Bottom housing: ' || COALESCE(s.bottom_housing, 'N/A') || ', Stem: ' || COALESCE(s.stem, 'N/A') ||'.'
        ) as description_text,
        1 - ((s.embedding::text)::vector <=> ${queryEmbeddingSql}) AS similarity
      FROM ${switchesTable} AS s
      ORDER BY similarity DESC
      LIMIT ${AI_CONFIG.CONTEXT_RESULTS_COUNT}
    `);

    const switchContextsForPrompt = retrievedRawContexts.filter(
      (c) => c.similarity != null && c.similarity >= AI_CONFIG.SIMILARITY_THRESHOLD
    );

    if (switchContextsForPrompt.length === 0) {
      try {
        const fallbackPrompt = AI_CONFIG.GENERAL_KNOWLEDGE_FALLBACK_PROMPT(rawUserQuery);
        return await this.getGeminiService().generate(fallbackPrompt);
      } catch (error) {
        console.warn(
          'GeminiService failed during General Knowledge Fallback, using hardcoded fallback:',
          error
        );

        const randomIndex = Math.floor(
          Math.random() * AI_CONFIG.HARDCODED_FALLBACK_MESSAGES.length
        );
        return AI_CONFIG.HARDCODED_FALLBACK_MESSAGES[randomIndex];
      }
    }

    const historyForPrompt = await this.getConversationHistoryForPrompt(currentConversationId);
    const prompt = PromptBuilder.buildPrompt(
      historyForPrompt,
      switchContextsForPrompt,
      rawUserQuery
    );

    return await this.getGeminiService().generate(prompt);
  }

  /**
   * Parse structured JSON response from LLM for comparison queries
   * Returns both the structured data and a fallback content string
   */
  private parseStructuredComparisonResponse(llmResponse: string): {
    isStructured: boolean;
    structuredData?: {
      comparisonTable: Record<string, any>;
      summary: string;
      recommendations: Array<{ text: string; reasoning: string }>;
    };
    fallbackContent: string;
  } {
    try {
      const parsed = JSON.parse(llmResponse.trim());

      if (
        parsed.comparisonTable &&
        parsed.summary &&
        Array.isArray(parsed.recommendations) &&
        parsed.recommendations.every((rec: any) => rec.text && rec.reasoning)
      ) {
        return {
          isStructured: true,
          structuredData: {
            comparisonTable: parsed.comparisonTable,
            summary: parsed.summary,
            recommendations: parsed.recommendations
          },
          fallbackContent: parsed.summary || 'Comparison completed successfully.'
        };
      }

      console.warn('LLM returned valid JSON but missing required comparison fields');
      return {
        isStructured: false,
        fallbackContent: llmResponse
      };
    } catch (e) {
      console.log('LLM response is not JSON, treating as regular text content', e);
      return {
        isStructured: false,
        fallbackContent: llmResponse
      };
    }
  }

  /** Full RAG-powered message processing */
  async processMessage(userId: string, request: ChatRequest): Promise<ChatResponse> {
    const rawUserQuery = this.truncateText(request.message, AI_CONFIG.MAX_OUTPUT_TOKENS * 100);

    try {
      // Step 0: Detect if this is a comparison request
      const comparisonIntent = await this.detectComparisonIntent(rawUserQuery);

      // 1) Get or create conversation
      const conversation = await withDb(async () => {
        if (request.conversationId) {
          const [existing] = await db
            .select()
            .from(conversations)
            .where(
              and(eq(conversations.id, request.conversationId), eq(conversations.userId, userId))
            )
            .limit(1);
          if (!existing) throw new Error('Conversation not found or unauthorized');
          return existing;
        }
        const [created] = await db
          .insert(conversations)
          .values({
            userId,
            title: this.truncateText(rawUserQuery, 100),
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        return created;
      });
      const currentConversationId = conversation.id;

      // 2) Save user message
      await db
        .insert(messagesTable)
        .values({
          conversationId: currentConversationId,
          userId,
          content: rawUserQuery,
          role: 'user',
          createdAt: new Date(),
          timestamp: new Date()
        })
        .returning();

      if (comparisonIntent.isComparison) {
        console.log(`Detected comparison intent with confidence: ${comparisonIntent.confidence}`);

        try {
          const comparisonRequest = await this.processComparisonQuery(rawUserQuery);

          if (!comparisonRequest.isValidComparison) {
            const assistantText =
              comparisonRequest.userFeedbackMessage ||
              "I couldn't identify enough switches for a comparison. Could you please specify which switches you'd like me to compare?";

            const [assistantMsgRecord] = await db
              .insert(messagesTable)
              .values({
                conversationId: currentConversationId,
                userId,
                content: assistantText,
                role: 'assistant',
                metadata: {
                  model: AI_CONFIG.GEMINI_MODEL,
                  isComparison: true,
                  comparisonValid: false,
                  comparisonConfidence: comparisonRequest.confidence,
                  extractedSwitches: comparisonRequest.switchesToCompare,
                  processingNote: comparisonRequest.processingNote
                },
                createdAt: new Date(),
                timestamp: new Date()
              })
              .returning();

            await db
              .update(conversations)
              .set({ updatedAt: new Date() })
              .where(eq(conversations.id, currentConversationId));

            return {
              id: assistantMsgRecord.id,
              role: 'assistant',
              content: assistantText,
              metadata: assistantMsgRecord.metadata as Record<string, any>
            };
          }

          let retrievalResult: ComparisonDataRetrievalResult;
          try {
            retrievalResult = await this.retrieveComprehensiveSwitchData(
              comparisonRequest.switchesToCompare
            );
          } catch (retrievalError) {
            console.error('Critical failure in switch data retrieval:', retrievalError);
            const assistantText = `I encountered an issue retrieving switch information for your comparison. This might be due to database connectivity problems. Please try again in a moment, or you can ask about individual switches instead.`;

            const [assistantMsgRecord] = await db
              .insert(messagesTable)
              .values({
                conversationId: currentConversationId,
                userId,
                content: assistantText,
                role: 'assistant',
                metadata: {
                  model: AI_CONFIG.GEMINI_MODEL,
                  isComparison: true,
                  comparisonValid: false,
                  error: 'data_retrieval_failure',
                  errorDetails:
                    retrievalError instanceof Error
                      ? retrievalError.message
                      : 'Unknown retrieval error'
                },
                createdAt: new Date(),
                timestamp: new Date()
              })
              .returning();

            await db
              .update(conversations)
              .set({ updatedAt: new Date() })
              .where(eq(conversations.id, currentConversationId));

            return {
              id: assistantMsgRecord.id,
              role: 'assistant',
              content: assistantText,
              metadata: assistantMsgRecord.metadata as Record<string, any>
            };
          }

          const foundSwitches = retrievalResult.switchesData.filter((s) => s.isFound);
          if (foundSwitches.length === 0) {
            const assistantText =
              `I couldn't find any of the switches you mentioned (${comparisonRequest.switchesToCompare.join(', ')}) in our database. This could be due to:\n\n` +
              `• Misspelled switch names\n` +
              `• Switches not yet in our database\n` +
              `• Database connectivity issues\n\n` +
              `Could you please check the switch names and try again? You can also ask me about individual switches to see what's available.`;

            const [assistantMsgRecord] = await db
              .insert(messagesTable)
              .values({
                conversationId: currentConversationId,
                userId,
                content: assistantText,
                role: 'assistant',
                metadata: {
                  model: AI_CONFIG.GEMINI_MODEL,
                  isComparison: true,
                  comparisonValid: false,
                  error: 'no_switches_found',
                  requestedSwitches: comparisonRequest.switchesToCompare,
                  retrievalNotes: retrievalResult.retrievalNotes
                },
                createdAt: new Date(),
                timestamp: new Date()
              })
              .returning();

            await db
              .update(conversations)
              .set({ updatedAt: new Date() })
              .where(eq(conversations.id, currentConversationId));

            return {
              id: assistantMsgRecord.id,
              role: 'assistant',
              content: assistantText,
              metadata: assistantMsgRecord.metadata as Record<string, any>
            };
          }

          if (foundSwitches.length === 1) {
            const foundSwitch = foundSwitches[0];
            const assistantText =
              `I could only find "${foundSwitch.name}" from your comparison request. For a meaningful comparison, I need at least two switches from our database.\n\n` +
              `${retrievalResult.missingSwitches.length > 0 ? `I couldn't find: ${retrievalResult.missingSwitches.join(', ')}\n\n` : ''}` +
              `Would you like me to:\n• Provide detailed information about ${foundSwitch.name}\n• Suggest similar switches to compare with ${foundSwitch.name}\n• Help you find the correct names for the other switches?`;

            const [assistantMsgRecord] = await db
              .insert(messagesTable)
              .values({
                conversationId: currentConversationId,
                userId,
                content: assistantText,
                role: 'assistant',
                metadata: {
                  model: AI_CONFIG.GEMINI_MODEL,
                  isComparison: true,
                  comparisonValid: false,
                  error: 'insufficient_switches_found',
                  foundSwitches: [foundSwitch.name],
                  missingSwitches: retrievalResult.missingSwitches
                },
                createdAt: new Date(),
                timestamp: new Date()
              })
              .returning();

            await db
              .update(conversations)
              .set({ updatedAt: new Date() })
              .where(eq(conversations.id, currentConversationId));

            return {
              id: assistantMsgRecord.id,
              role: 'assistant',
              content: assistantText,
              metadata: assistantMsgRecord.metadata as Record<string, any>
            };
          }

          let formattedData: any;
          try {
            formattedData = this.formatMissingDataForPrompt(retrievalResult);
          } catch (formatError) {
            console.error('Error formatting data for prompt:', formatError);
            const assistantText = AI_CONFIG.FALLBACK_ERROR_MESSAGE_INTERNAL;

            const [assistantMsgRecord] = await db
              .insert(messagesTable)
              .values({
                conversationId: currentConversationId,
                userId,
                content: assistantText,
                role: 'assistant',
                metadata: {
                  model: AI_CONFIG.GEMINI_MODEL,
                  isComparison: true,
                  error: 'data_formatting_failure',
                  errorDetails:
                    formatError instanceof Error ? formatError.message : 'Unknown formatting error'
                },
                createdAt: new Date(),
                timestamp: new Date()
              })
              .returning();

            await db
              .update(conversations)
              .set({ updatedAt: new Date() })
              .where(eq(conversations.id, currentConversationId));

            return {
              id: assistantMsgRecord.id,
              role: 'assistant',
              content: assistantText,
              metadata: assistantMsgRecord.metadata as Record<string, any>
            };
          }

          const historyForPrompt =
            await this.getConversationHistoryForPrompt(currentConversationId);

          let comparisonPrompt: string;
          try {
            comparisonPrompt = PromptBuilder.buildComparisonPrompt(
              historyForPrompt,
              formattedData.switchDataBlocks,
              formattedData.promptInstructions,
              rawUserQuery,
              comparisonRequest.switchesToCompare
            );
          } catch (promptError) {
            console.error('Error building comparison prompt:', promptError);
            const assistantText = AI_CONFIG.FALLBACK_ERROR_MESSAGE_INTERNAL;

            const [assistantMsgRecord] = await db
              .insert(messagesTable)
              .values({
                conversationId: currentConversationId,
                userId,
                content: assistantText,
                role: 'assistant',
                metadata: {
                  model: AI_CONFIG.GEMINI_MODEL,
                  isComparison: true,
                  error: 'prompt_building_failure',
                  errorDetails:
                    promptError instanceof Error ? promptError.message : 'Unknown prompt error'
                },
                createdAt: new Date(),
                timestamp: new Date()
              })
              .returning();

            await db
              .update(conversations)
              .set({ updatedAt: new Date() })
              .where(eq(conversations.id, currentConversationId));

            return {
              id: assistantMsgRecord.id,
              role: 'assistant',
              content: assistantText,
              metadata: assistantMsgRecord.metadata as Record<string, any>
            };
          }

          const assistantText = await this.getGeminiService().generate(comparisonPrompt);

          if (assistantText === AI_CONFIG.FALLBACK_ERROR_MESSAGE_LLM) {
            const enhancedFallback = `I apologize, but I'm having trouble generating the comparison for ${foundSwitches.map((s) => s.name).join(' and ')} right now. This could be due to AI service limitations. Please try again in a moment, or feel free to ask about these switches individually.`;

            const [assistantMsgRecord] = await db
              .insert(messagesTable)
              .values({
                conversationId: currentConversationId,
                userId,
                content: enhancedFallback,
                role: 'assistant',
                metadata: {
                  model: AI_CONFIG.GEMINI_MODEL,
                  isComparison: true,
                  comparisonValid: true,
                  error: 'llm_generation_failure',
                  switchesCompared: comparisonRequest.switchesToCompare,
                  switchesFoundInDB: foundSwitches.map((s) => s.name)
                },
                createdAt: new Date(),
                timestamp: new Date()
              })
              .returning();

            await db
              .update(conversations)
              .set({ updatedAt: new Date() })
              .where(eq(conversations.id, currentConversationId));

            return {
              id: assistantMsgRecord.id,
              role: 'assistant',
              content: enhancedFallback,
              metadata: assistantMsgRecord.metadata as Record<string, any>
            };
          }

          const parsedResponse = this.parseStructuredComparisonResponse(assistantText);

          const responseContent = parsedResponse.fallbackContent;

          const [assistantMsgRecord] = await db
            .insert(messagesTable)
            .values({
              conversationId: currentConversationId,
              userId,
              content: responseContent,
              role: 'assistant',
              metadata: {
                model: AI_CONFIG.GEMINI_MODEL,
                isComparison: true,
                comparisonValid: true,
                comparisonConfidence: comparisonRequest.confidence,
                switchesCompared: comparisonRequest.switchesToCompare,
                switchesFoundInDB: foundSwitches.map((s) => s.name),
                missingSwitches: retrievalResult.missingSwitches,
                hasDataGaps: retrievalResult.hasDataGaps,
                promptLength: comparisonPrompt.length,
                retrievalNotes: retrievalResult.retrievalNotes,
                isStructuredOutput: parsedResponse.isStructured,
                ...(parsedResponse.isStructured && {
                  structuredData: parsedResponse.structuredData
                })
              },
              createdAt: new Date(),
              timestamp: new Date()
            })
            .returning();

          await db
            .update(conversations)
            .set({ updatedAt: new Date() })
            .where(eq(conversations.id, currentConversationId));

          const baseResponse = {
            id: assistantMsgRecord.id,
            role: 'assistant' as const,
            content: responseContent,
            metadata: assistantMsgRecord.metadata as Record<string, any>
          };

          const switchesWithRelevance = foundSwitches.map((switchData) => ({
            name: switchData.name,
            manufacturer: switchData.manufacturer,
            type: switchData.type,
            relevance_score: switchData.matchConfidence
          }));

          if (parsedResponse.isStructured && parsedResponse.structuredData) {
            return {
              ...baseResponse,
              comparisonTable: parsedResponse.structuredData.comparisonTable,
              summary: parsedResponse.structuredData.summary,
              recommendations: parsedResponse.structuredData.recommendations,
              switches: switchesWithRelevance
            };
          } else {
            return {
              ...baseResponse,
              switches: switchesWithRelevance
            };
          }
        } catch (comparisonError) {
          console.error('Critical error in comparison flow:', comparisonError);
          const assistantText = AI_CONFIG.FALLBACK_ERROR_MESSAGE_INTERNAL;

          const [assistantMsgRecord] = await db
            .insert(messagesTable)
            .values({
              conversationId: currentConversationId,
              userId,
              content: assistantText,
              role: 'assistant',
              metadata: {
                model: AI_CONFIG.GEMINI_MODEL,
                isComparison: true,
                error: 'critical_comparison_failure',
                errorDetails:
                  comparisonError instanceof Error
                    ? comparisonError.message
                    : 'Unknown comparison error'
              },
              createdAt: new Date(),
              timestamp: new Date()
            })
            .returning();

          await db
            .update(conversations)
            .set({ updatedAt: new Date() })
            .where(eq(conversations.id, currentConversationId));

          return {
            id: assistantMsgRecord.id,
            role: 'assistant',
            content: assistantText,
            metadata: assistantMsgRecord.metadata as Record<string, any>
          };
        }
      } else {
        const { assistantText, switchesWithRelevance } = await this.processStandardRAG(
          rawUserQuery,
          currentConversationId
        );

        const [assistantMsgRecord] = await db
          .insert(messagesTable)
          .values({
            conversationId: currentConversationId,
            userId,
            content: assistantText,
            role: 'assistant',
            metadata: {
              model: AI_CONFIG.GEMINI_MODEL,
              isComparison: false,
              switchCount: switchesWithRelevance.length,
              ...(switchesWithRelevance.length > 0 && {
                switchesWithRelevance: switchesWithRelevance
              })
            },
            createdAt: new Date(),
            timestamp: new Date()
          })
          .returning();

        await db
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, currentConversationId));

        const baseResponse = {
          id: assistantMsgRecord.id,
          role: 'assistant' as const,
          content: assistantText,
          metadata: assistantMsgRecord.metadata as Record<string, any>
        };

        if (switchesWithRelevance.length > 0) {
          return {
            ...baseResponse,
            switches: switchesWithRelevance
          };
        } else {
          return baseResponse;
        }
      }
    } catch (error: any) {
      console.error(
        'Error processing message in ChatService:',
        error.message,
        error.cause || error.stack
      );
      if (error.cause && error.cause.query) {
        console.error('Failed Drizzle Query:', error.cause.query);
        console.error('Failed Drizzle Params:', error.cause.params);
      }
      return {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: AI_CONFIG.FALLBACK_ERROR_MESSAGE_INTERNAL,
        metadata: { error: true, details: error.message }
      };
    }
  }

  async getConversation(userId: string, conversationId: string): Promise<UIChatMessage[]> {
    const [convoCheck] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .limit(1);
    if (!convoCheck) {
      throw new Error('Conversation not found or access denied.');
    }

    const history = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(messagesTable.timestamp);

    return history.map((msg) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      metadata: msg.metadata as Record<string, any> | undefined,
      createdAt: msg.timestamp
    }));
  }

  async listConversations(userId: string) {
    return db
      .select({
        id: conversations.id,
        userId: conversations.userId,
        title: conversations.title,
        category: conversations.category,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt
      })
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt));
  }

  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    const [conversation] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .limit(1);

    if (!conversation) {
      throw new Error('Conversation not found or unauthorized to delete.');
    }
    await db.delete(messagesTable).where(eq(messagesTable.conversationId, conversationId));
    await db.delete(conversations).where(eq(conversations.id, conversationId));
  }
}

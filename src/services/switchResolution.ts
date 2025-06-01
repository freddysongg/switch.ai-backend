/**
 * Switch Resolution Service for Enhanced Switch Comparison
 *
 * This service provides multi-stage switch name resolution using AI-powered
 * intent parsing, contextual brand completion, and tiered matching strategies
 * to improve switch identification accuracy and handle ambiguous queries.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

import { getAllKnownMaterialTerms, normalizeMaterialTerm } from '../config/materialProperties.js';

export interface SwitchResolutionResult {
  originalQuery: string;
  resolvedSwitches: ResolvedSwitch[];
  confidence: number;
  resolutionMethod: 'exact' | 'fuzzy' | 'embedding' | 'ai_disambiguation' | 'ai_general_knowledge';
  warnings: string[];
  intentParseResult?: SwitchIntentParseResult;
}

export interface ResolvedSwitch {
  queryFragment: string;
  resolvedName: string;
  confidence: number;
  databaseMatch: boolean;
  brandCompleted: boolean;
  metadata?: {
    originalQuery: string;
    inferredBrand?: string;
    inferredType?: string;
    ambiguityResolved?: boolean;
  };
}

export interface SwitchIntentParseResult {
  intendedSwitches: string[];
  implicitBrand?: string;
  implicitType?: string;
  queryContext: {
    comparisonType: 'switches' | 'materials' | 'characteristics';
    useCase?: 'gaming' | 'typing' | 'office' | 'programming';
    preferences?: string[];
  };
  confidence: number;
}

export class SwitchResolutionService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }

  /**
   * Main resolution method implementing multi-stage strategy
   * Combines AI intent parsing with tiered matching for comprehensive switch resolution
   *
   * @param userQuery - User's input query containing switch references
   * @param availableSwitches - List of switches available in database
   * @param options - Configuration options for resolution behavior
   * @returns Comprehensive resolution result with confidence scoring
   */
  async resolveSwitches(
    userQuery: string,
    availableSwitches: string[] = [],
    options: {
      enableAiDisambiguation?: boolean;
      enableBrandCompletion?: boolean;
      confidenceThresholds?: {
        exact: number;
        fuzzy: number;
        embedding: number;
      };
    } = {}
  ): Promise<SwitchResolutionResult> {
    console.log(`🔧 SwitchResolutionService.resolveSwitches called with query: "${userQuery}"`);
    console.log(`📊 Available switches count: ${availableSwitches.length}`);
    console.log(`⚙️ Options:`, options);

    const thresholds = {
      exact: 0.95,
      fuzzy: 0.8,
      embedding: 0.65,
      ...options.confidenceThresholds
    };

    try {
      console.log(`🧠 Stage 1: Calling parseUserIntent...`);
      const intentResult = await this.parseUserIntent(userQuery);
      console.log(`🎯 Intent parsing result:`, {
        intendedSwitches: intentResult.intendedSwitches,
        confidence: intentResult.confidence,
        implicitBrand: intentResult.implicitBrand
      });

      let resolvedSwitches: ResolvedSwitch[] = [];
      let overallConfidence = 0;
      let resolutionMethod: SwitchResolutionResult['resolutionMethod'] = 'exact';
      const warnings: string[] = [];

      console.log(
        `🔄 Stage 2: Processing ${intentResult.intendedSwitches.length} intended switches...`
      );
      for (const intendedSwitch of intentResult.intendedSwitches) {
        console.log(`🎯 Processing intended switch: "${intendedSwitch}"`);

        const switchResult = await this.resolveSingleSwitch(
          intendedSwitch,
          intentResult,
          availableSwitches,
          thresholds,
          options
        );

        console.log(`✅ Single switch resolution result:`, {
          queryFragment: switchResult.queryFragment,
          resolvedName: switchResult.resolvedName,
          confidence: switchResult.confidence,
          databaseMatch: switchResult.databaseMatch
        });

        resolvedSwitches.push(switchResult);

        if (switchResult.confidence < thresholds.exact && resolutionMethod === 'exact') {
          resolutionMethod =
            switchResult.confidence >= thresholds.fuzzy
              ? 'fuzzy'
              : switchResult.confidence >= thresholds.embedding
                ? 'embedding'
                : 'ai_disambiguation';
        }
      }

      overallConfidence =
        resolvedSwitches.length > 0
          ? resolvedSwitches.reduce((sum, s) => sum + s.confidence, 0) / resolvedSwitches.length
          : 0;

      resolvedSwitches.forEach((switch_) => {
        if (switch_.confidence < thresholds.embedding) {
          warnings.push(
            `Low confidence match for "${switch_.queryFragment}" → "${switch_.resolvedName}" (${(switch_.confidence * 100).toFixed(1)}%)`
          );
        }
      });

      const result = {
        originalQuery: userQuery,
        resolvedSwitches,
        confidence: overallConfidence,
        resolutionMethod,
        warnings,
        intentParseResult: intentResult
      };

      console.log(`🎉 SwitchResolutionService completed successfully:`, {
        resolvedCount: resolvedSwitches.length,
        overallConfidence,
        resolutionMethod,
        warningCount: warnings.length
      });

      return result;
    } catch (error) {
      console.error(`❌ SwitchResolutionService.resolveSwitches failed:`, error);
      console.error(`❌ Error details:`, error instanceof Error ? error.message : 'Unknown error');
      console.error(`❌ Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
  }

  /**
   * AI-powered intent parsing using Gemini 2.0 Flash
   * Analyzes user queries to extract switch names, brands, and comparison context
   *
   * @param userQuery - Raw user input to analyze
   * @returns Structured intent parse result with extracted information
   */
  async parseUserIntent(userQuery: string): Promise<SwitchIntentParseResult> {
    console.log(`🤖 parseUserIntent called for query: "${userQuery}"`);

    const prompt = `
MECHANICAL_KEYBOARD_SWITCH_INTENT_PARSER

Task: Parse user query to extract intended mechanical keyboard switches for comparison.

Query: "${userQuery}"

Instructions:
1. Identify ALL switch names/references in the query (explicit and implicit)
2. Detect implicit brand context (e.g., "red vs brown vs blue" likely means "Cherry MX Red vs Cherry MX Brown vs Cherry MX Blue")
3. Determine query context and use case
4. For MATERIAL comparisons, extract material names as preferences
5. For CHARACTERISTICS comparisons, extract characteristics as preferences
6. Return structured JSON response

Consider these patterns:
- Color-only references often imply Cherry MX (red, brown, blue, black, etc.)
- "linear vs tactile" comparisons might need brand completion
- Gaming/typing/office context affects interpretation
- Casual language like "smooth" or "clicky" indicates switch characteristics
- Material references like "polycarbonate vs nylon" or "POM vs PC housing" indicate material comparisons
- Characteristics like "smooth vs clicky" or "linear vs tactile" indicate characteristics comparisons

Response format (JSON only):
{
  "intendedSwitches": ["switch1", "switch2", ...],
  "implicitBrand": "brand_if_detected",
  "implicitType": "type_if_detected", 
  "queryContext": {
    "comparisonType": "switches|materials|characteristics",
    "useCase": "gaming|typing|office|programming|null",
    "preferences": ["preference1", "preference2"]
  },
  "confidence": 0.0-1.0
}

Examples:
Query: "red vs brown switches for gaming"
Response: {"intendedSwitches": ["Cherry MX Red", "Cherry MX Brown"], "implicitBrand": "Cherry MX", "queryContext": {"comparisonType": "switches", "useCase": "gaming", "preferences": ["red", "brown"]}, "confidence": 0.9}

Query: "Gateron Oil King vs Alpaca linear switches"  
Response: {"intendedSwitches": ["Gateron Oil King", "Alpaca Linear"], "queryContext": {"comparisonType": "switches", "preferences": ["linear"]}, "confidence": 0.95}

Query: "Compare switches with polycarbonate vs nylon housing"
Response: {"intendedSwitches": [], "queryContext": {"comparisonType": "materials", "preferences": ["polycarbonate", "nylon"]}, "confidence": 0.8}

Query: "smooth vs clicky switches for typing"
Response: {"intendedSwitches": [], "queryContext": {"comparisonType": "characteristics", "useCase": "typing", "preferences": ["smooth", "clicky"]}, "confidence": 0.85}

Query: "POM vs PC housing material comparison"
Response: {"intendedSwitches": [], "queryContext": {"comparisonType": "materials", "preferences": ["POM", "PC"]}, "confidence": 0.9}
`;

    try {
      console.log(`📤 Sending request to Gemini API...`);
      const result = await this.model.generateContent(prompt);
      console.log(`📥 Received response from Gemini API`);

      const response = await result.response;
      const text = response.text();
      console.log(`📝 Gemini response text length: ${text.length} characters`);
      console.log(`📝 Gemini response preview: ${text.substring(0, 200)}...`);

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error(`❌ No JSON found in Gemini response: ${text}`);
        throw new Error('No JSON found in AI response');
      }

      console.log(`🔍 Found JSON in response: ${jsonMatch[0]}`);
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`✅ Successfully parsed JSON:`, parsed);

      const result_ = {
        intendedSwitches: parsed.intendedSwitches || [],
        implicitBrand: parsed.implicitBrand,
        implicitType: parsed.implicitType,
        queryContext: {
          comparisonType: parsed.queryContext?.comparisonType || 'switches',
          useCase: parsed.queryContext?.useCase,
          preferences: parsed.queryContext?.preferences || []
        },
        confidence: parsed.confidence || 0.5
      };

      console.log(`🎯 Final intent parse result:`, result_);
      return result_;
    } catch (error) {
      console.error('❌ AI intent parsing failed:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error');

      console.log(`🔄 Falling back to basic intent parsing...`);
      return this.fallbackIntentParsing(userQuery);
    }
  }

  /**
   * Resolve a single switch through tiered matching strategy
   * Implements exact, fuzzy, embedding, and AI-powered disambiguation
   */
  private async resolveSingleSwitch(
    intendedSwitch: string,
    intentContext: SwitchIntentParseResult,
    availableSwitches: string[],
    thresholds: { exact: number; fuzzy: number; embedding: number },
    options: any
  ): Promise<ResolvedSwitch> {
    const exactMatch = this.findExactMatch(intendedSwitch, availableSwitches);
    if (exactMatch && exactMatch.confidence >= thresholds.exact) {
      return {
        queryFragment: intendedSwitch,
        resolvedName: exactMatch.match,
        confidence: exactMatch.confidence,
        databaseMatch: true,
        brandCompleted: false
      };
    }

    if (options.enableBrandCompletion && intentContext.implicitBrand) {
      const brandCompletedName = this.applyBrandCompletion(
        intendedSwitch,
        intentContext.implicitBrand
      );
      const fuzzyMatch = this.findFuzzyMatch(brandCompletedName, availableSwitches);

      if (fuzzyMatch && fuzzyMatch.confidence >= thresholds.fuzzy) {
        return {
          queryFragment: intendedSwitch,
          resolvedName: fuzzyMatch.match,
          confidence: fuzzyMatch.confidence,
          databaseMatch: true,
          brandCompleted: true,
          metadata: {
            originalQuery: intendedSwitch,
            inferredBrand: intentContext.implicitBrand
          }
        };
      }
    }

    const fuzzyMatch = this.findFuzzyMatch(intendedSwitch, availableSwitches);
    if (fuzzyMatch && fuzzyMatch.confidence >= thresholds.fuzzy) {
      return {
        queryFragment: intendedSwitch,
        resolvedName: fuzzyMatch.match,
        confidence: fuzzyMatch.confidence,
        databaseMatch: true,
        brandCompleted: false
      };
    }

    const embeddingMatch = await this.findEmbeddingMatch(intendedSwitch, availableSwitches);
    if (embeddingMatch && embeddingMatch.confidence >= thresholds.embedding) {
      return {
        queryFragment: intendedSwitch,
        resolvedName: embeddingMatch.match,
        confidence: embeddingMatch.confidence,
        databaseMatch: true,
        brandCompleted: false
      };
    }

    if (options.enableAiDisambiguation) {
      const aiMatch = await this.aiDisambiguation(intendedSwitch, availableSwitches, intentContext);
      if (aiMatch) {
        return aiMatch;
      }
    }

    return {
      queryFragment: intendedSwitch,
      resolvedName: intendedSwitch,
      confidence: 0.3,
      databaseMatch: false,
      brandCompleted: false,
      metadata: {
        originalQuery: intendedSwitch
      }
    };
  }

  /**
   * Contextual brand completion logic
   * Applies intelligent brand prefixes based on context clues
   */
  private applyBrandCompletion(switchName: string, implicitBrand: string): string {
    const normalizedSwitch = switchName.toLowerCase().trim();
    const normalizedBrand = implicitBrand.toLowerCase();

    if (normalizedSwitch.includes(normalizedBrand)) {
      return switchName;
    }

    if (normalizedBrand.includes('cherry') || normalizedBrand.includes('mx')) {
      const colorPatterns = [
        'red',
        'brown',
        'blue',
        'black',
        'clear',
        'green',
        'white',
        'yellow',
        'grey',
        'gray'
      ];

      if (colorPatterns.some((color) => normalizedSwitch.includes(color))) {
        return `Cherry MX ${this.capitalizeFirst(switchName)}`;
      }
    }

    return `${implicitBrand} ${switchName}`;
  }

  /**
   * Exact matching with confidence scoring
   */
  private findExactMatch(
    query: string,
    availableSwitches: string[]
  ): { match: string; confidence: number } | null {
    const normalizedQuery = query.toLowerCase().trim();

    for (const switchName of availableSwitches) {
      const normalizedSwitch = switchName.toLowerCase().trim();

      if (normalizedQuery === normalizedSwitch) {
        return { match: switchName, confidence: 1.0 };
      }
    }

    return null;
  }

  /**
   * Fuzzy matching with confidence scoring using string similarity
   */
  private findFuzzyMatch(
    query: string,
    availableSwitches: string[]
  ): { match: string; confidence: number } | null {
    const normalizedQuery = query.toLowerCase().trim();
    let bestMatch: { match: string; confidence: number } | null = null;

    for (const switchName of availableSwitches) {
      const normalizedSwitch = switchName.toLowerCase().trim();
      const similarity = this.calculateStringSimilarity(normalizedQuery, normalizedSwitch);

      if (similarity > 0.7 && (!bestMatch || similarity > bestMatch.confidence)) {
        bestMatch = { match: switchName, confidence: similarity };
      }
    }

    return bestMatch;
  }

  /**
   * Embedding-based matching (placeholder for integration with existing embedding system)
   */
  private async findEmbeddingMatch(
    query: string,
    availableSwitches: string[]
  ): Promise<{ match: string; confidence: number } | null> {
    return null;
  }

  /**
   * AI-powered disambiguation for unclear matches
   * Uses Gemini to make intelligent matching decisions
   */
  private async aiDisambiguation(
    query: string,
    availableSwitches: string[],
    context: SwitchIntentParseResult
  ): Promise<ResolvedSwitch | null> {
    if (availableSwitches.length === 0) return null;

    const prompt = `
SWITCH_DISAMBIGUATION_TASK

User Query Fragment: "${query}"
Query Context: ${JSON.stringify(context.queryContext)}
Available Switches: ${availableSwitches.slice(0, 20).join(', ')}${availableSwitches.length > 20 ? '...' : ''}

Task: Match the user's query fragment to the most appropriate switch from the available switches list, or determine if none match well.

Consider:
- Partial name matches
- Alternative naming conventions  
- Brand variations
- User intent and context

Response format (JSON only):
{
  "bestMatch": "exact_switch_name_from_list_or_null",
  "confidence": 0.0-1.0,
  "reasoning": "brief_explanation"
}

If no good match exists (confidence < 0.6), return {"bestMatch": null, "confidence": 0.0, "reasoning": "no_suitable_match"}
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.bestMatch || parsed.confidence < 0.6) {
        return null;
      }

      return {
        queryFragment: query,
        resolvedName: parsed.bestMatch,
        confidence: parsed.confidence,
        databaseMatch: true,
        brandCompleted: false,
        metadata: {
          originalQuery: query,
          ambiguityResolved: true
        }
      };
    } catch (error) {
      console.error('AI disambiguation failed:', error);
      return null;
    }
  }

  /**
   * Fallback intent parsing for when AI fails
   * Uses pattern matching and heuristics
   */
  private fallbackIntentParsing(userQuery: string): SwitchIntentParseResult {
    const query = userQuery.toLowerCase();
    const words = query.split(/\s+/);

    const intendedSwitches: string[] = [];
    let implicitBrand: string | undefined;

    const colors = ['red', 'brown', 'blue', 'black', 'clear', 'green', 'white', 'yellow'];
    const foundColors = colors.filter((color) => query.includes(color));

    if (foundColors.length > 1 && !query.includes('cherry') && !query.includes('gateron')) {
      implicitBrand = 'Cherry MX';
      intendedSwitches.push(
        ...foundColors.map((color) => `Cherry MX ${this.capitalizeFirst(color)}`)
      );
    }

    words.forEach((word, index) => {
      if (index < words.length - 1) {
        const twoWordCombo = `${word} ${words[index + 1]}`;
        if (this.looksLikeSwitchName(twoWordCombo)) {
          intendedSwitches.push(this.capitalizeWords(twoWordCombo));
        }
      }
    });

    return {
      intendedSwitches: intendedSwitches.length > 0 ? intendedSwitches : [userQuery],
      implicitBrand,
      queryContext: {
        comparisonType: 'switches',
        useCase: this.detectUseCase(query),
        preferences: this.extractPreferences(query)
      },
      confidence: 0.5
    };
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1.0;

    const distance = this.levenshteinDistance(str1, str2);
    return (maxLength - distance) / maxLength;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private capitalizeWords(str: string): string {
    return str
      .split(' ')
      .map((word) => this.capitalizeFirst(word))
      .join(' ');
  }

  private looksLikeSwitchName(str: string): boolean {
    const switchIndicators = ['switch', 'mx', 'gateron', 'cherry', 'linear', 'tactile', 'clicky'];
    return switchIndicators.some((indicator) => str.includes(indicator));
  }

  private detectUseCase(query: string): 'gaming' | 'typing' | 'office' | 'programming' | undefined {
    if (query.includes('gaming') || query.includes('game')) return 'gaming';
    if (query.includes('office') || query.includes('work') || query.includes('quiet'))
      return 'office';
    if (query.includes('programming') || query.includes('coding')) return 'programming';
    if (query.includes('typing') || query.includes('writing')) return 'typing';
    return undefined;
  }

  private extractPreferences(query: string): string[] {
    const preferences: string[] = [];

    const characteristicWords = [
      'smooth',
      'clicky',
      'tactile',
      'linear',
      'quiet',
      'loud',
      'light',
      'heavy',
      'fast',
      'responsive'
    ];
    characteristicWords.forEach((pref) => {
      if (query.toLowerCase().includes(pref)) {
        preferences.push(pref);
      }
    });

    const allMaterialTerms = getAllKnownMaterialTerms();
    for (const term of allMaterialTerms) {
      if (query.toLowerCase().includes(term.toLowerCase())) {
        const normalized = normalizeMaterialTerm(term);
        if (normalized && !preferences.includes(normalized)) {
          preferences.push(normalized);
        }
      }
    }

    return preferences;
  }
}

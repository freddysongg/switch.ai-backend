import { and, desc, eq, sql } from 'drizzle-orm';

import { AI_CONFIG } from '../config/ai.config.js';
import { arrayToVector, db, withDb } from '../db/index.js';
import {
  conversations,
  messages as messagesTable,
  switches as switchesTable
} from '../db/schema.js';
import { ChatRequest, ChatResponse, ChatMessage as UIChatMessage } from '../types/chat.js';
import { CharacteristicsComparisonService } from './chat/comparison/characteristics.js';
import { MaterialComparisonService } from './chat/comparison/materials.js';
import {
  ComparisonDataRetrievalResult,
  ComparisonIntent,
  ProcessedComparisonRequest,
  SwitchContextForPrompt
} from './chat/comparison/types.js';
import { DataRetrievalService } from './chat/database/dataRetrieval.js';
// Import refactored services
import { SwitchQueryService } from './chat/database/switchQuery.js';
import { LocalEmbeddingService } from './embeddingsLocal.js';
import { GeminiService } from './gemini.js';
import { MaterialContextService } from './materialContext.js';
import { PromptBuilder, type EnhancedSwitchData } from './promptBuilder.js';
import { SwitchResolutionService, type SwitchResolutionResult } from './switchResolution.js';

const embeddingService = new LocalEmbeddingService();
const geminiService = new GeminiService();

export class ChatService {
  private switchResolutionService: SwitchResolutionService;
  private materialContextService: MaterialContextService;

  // New refactored services
  private switchQueryService: SwitchQueryService;
  private dataRetrievalService: DataRetrievalService;
  private characteristicsComparisonService: CharacteristicsComparisonService;
  private materialComparisonService: MaterialComparisonService;

  constructor() {
    try {
      // Validate environment variables
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        console.error(
          'FATAL: GEMINI_API_KEY environment variable is not set. Enhanced comparison features will be disabled.'
        );
        console.error('Please ensure .env.local file contains: GEMINI_API_KEY=your_actual_api_key');
      }

      // Initialize enhanced services with proper error handling
      console.log('Initializing ChatService enhanced components...');

      try {
        this.switchResolutionService = new SwitchResolutionService(geminiApiKey || 'dummy-key');
        console.log('✓ SwitchResolutionService initialized');
      } catch (error) {
        console.error('✗ Failed to initialize SwitchResolutionService:', error);
        throw new Error(
          `SwitchResolutionService initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      try {
        this.materialContextService = new MaterialContextService();
        console.log('✓ MaterialContextService initialized');
      } catch (error) {
        console.error('✗ Failed to initialize MaterialContextService:', error);
        throw new Error(
          `MaterialContextService initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      // Initialize new refactored services
      try {
        this.switchQueryService = new SwitchQueryService();
        this.dataRetrievalService = new DataRetrievalService();
        this.characteristicsComparisonService = new CharacteristicsComparisonService(
          geminiApiKey || 'dummy-key'
        );
        this.materialComparisonService = new MaterialComparisonService();
        console.log('✓ Refactored comparison services initialized');
      } catch (error) {
        console.error('✗ Failed to initialize refactored services:', error);
        throw new Error(
          `Refactored services initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      console.log('✓ ChatService fully initialized with enhanced comparison features');
    } catch (error) {
      console.error('FATAL: ChatService constructor failed:', error);
      throw error;
    }
  }

  private truncateText(text: string, max: number): string {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const lastSpaceIndex = cut.lastIndexOf(' ');
    return (lastSpaceIndex > 0 ? cut.slice(0, lastSpaceIndex) : cut) + '...';
  }

  /**
   * Fetch conversation history formatted for prompt building
   *
   * @param conversationId - ID of the conversation to retrieve history for
   * @returns Array of role/content message pairs for prompt injection
   */
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
   * Enhanced comparison intent detection using AI-powered analysis
   * Combines pattern recognition with SwitchResolutionService capabilities
   *
   * @param userQuery - User's input query to analyze
   * @returns ComparisonIntent with confidence score and extracted switch names
   */
  private async detectComparisonIntent(userQuery: string): Promise<ComparisonIntent> {
    const query = userQuery.toLowerCase().trim();
    let confidence = 0;
    let extractedSwitchNames: string[] = [];

    try {
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

      try {
        const availableSwitches = await this.getAllAvailableSwitchNames();

        const resolutionResult = await this.switchResolutionService.resolveSwitches(
          userQuery,
          availableSwitches,
          {
            enableAiDisambiguation: true,
            enableBrandCompletion: true,
            confidenceThresholds: {
              exact: 0.95,
              fuzzy: 0.8,
              embedding: 0.65
            }
          }
        );

        if (resolutionResult.resolvedSwitches.length >= 2) {
          extractedSwitchNames = resolutionResult.resolvedSwitches.map((s) => s.resolvedName);
          confidence += 0.5;
        } else if (resolutionResult.resolvedSwitches.length === 1 && hasComparisonKeyword) {
          extractedSwitchNames = resolutionResult.resolvedSwitches.map((s) => s.resolvedName);
          confidence += 0.2;
        }

        if (resolutionResult.confidence > 0.8) {
          confidence += 0.1;
        }
      } catch (resolutionError) {
        console.warn(
          'SwitchResolutionService failed, falling back to legacy extraction:',
          resolutionError
        );

        try {
          extractedSwitchNames =
            await this.switchQueryService.parseAndExtractSwitchNames(userQuery);
        } catch (embeddingError) {
          console.warn(
            'Embedding service also failed, using pattern-only extraction:',
            embeddingError
          );
          extractedSwitchNames =
            await this.switchQueryService.extractPotentialSwitchNames(userQuery);
        }

        try {
          const validatedSwitches =
            await this.switchQueryService.validateAndMatchSwitchNames(extractedSwitchNames);
          if (validatedSwitches.length >= 2) {
            confidence += 0.3;
            extractedSwitchNames = validatedSwitches;
          } else if (validatedSwitches.length === 1 && hasComparisonKeyword) {
            confidence += 0.1;
            extractedSwitchNames = validatedSwitches;
          }
        } catch (validationError) {
          console.warn('Database validation failed, using extracted names as-is:', validationError);
          confidence = confidence * 0.8;
        }
      }

      // Step 3: Look for "X vs Y" or "X versus Y" patterns (additional confidence boost)
      const vsPatterns = [
        /(\w[\w\s-]*?)\s+vs\s+(\w[\w\s-]*?)(?:\s|$|\?|\.)/gi,
        /(\w[\w\s-]*?)\s+versus\s+(\w[\w\s-]*?)(?:\s|$|\?|\.)/gi,
        /compare\s+(\w[\w\s-]*?)\s+(?:and|with|to)\s+(\w[\w\s-]*?)(?:\s|$|\?|\.)/gi,
        /difference\s+between\s+(\w[\w\s-]*?)\s+and\s+(\w[\w\s-]*?)(?:\s|$|\?|\.)/gi
      ];

      let hasDirectPattern = false;
      for (const pattern of vsPatterns) {
        const matches = [...query.matchAll(pattern)];
        if (matches.length > 0) {
          hasDirectPattern = true;
          confidence += 0.3;
          break;
        }
      }

      // Step 4: Additional heuristics
      // Check for multiple switch manufacturers mentioned
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

      // Ensure confidence doesn't exceed 1.0
      confidence = Math.min(confidence, 1.0);

      return {
        isComparison: confidence >= AI_CONFIG.COMPARISON_CONFIDENCE_THRESHOLD,
        confidence,
        extractedSwitchNames,
        originalQuery: userQuery
      };
    } catch (error) {
      console.error('Error in enhanced comparison intent detection:', error);

      // Ultimate fallback - return basic pattern matching
      const hasBasicPattern =
        query.includes('vs') || query.includes('versus') || query.includes('compare');
      return {
        isComparison: hasBasicPattern,
        confidence: hasBasicPattern ? 0.5 : 0.1,
        extractedSwitchNames: [],
        originalQuery: userQuery
      };
    }
  }

  /**
   * Get all available switch names from database for resolution service
   */
  private async getAllAvailableSwitchNames(): Promise<string[]> {
    return this.switchQueryService.getAllAvailableSwitchNames();
  }

  /**
   * Enhanced comparison processing using comprehensive AI-powered switch resolution
   * Handles multiple resolution strategies and fallback mechanisms
   *
   * @param userQuery - User's comparison query
   * @returns ProcessedComparisonRequest with resolution results and metadata
   */
  async processEnhancedComparison(userQuery: string): Promise<ProcessedComparisonRequest> {
    console.log(`🚀 Starting processEnhancedComparison for query: "${userQuery}"`);

    try {
      // Use SwitchResolutionService for comprehensive switch resolution
      console.log(`📡 Getting available switches from database...`);
      const availableSwitches = await this.getAllAvailableSwitchNames();
      console.log(`📊 Found ${availableSwitches.length} available switches in database`);

      console.log(`🧠 Calling SwitchResolutionService.resolveSwitches...`);
      const resolutionResult = await this.switchResolutionService.resolveSwitches(
        userQuery,
        availableSwitches,
        {
          enableAiDisambiguation: true,
          enableBrandCompletion: true,
          confidenceThresholds: {
            exact: 0.95,
            fuzzy: 0.8,
            embedding: 0.65
          }
        }
      );
      console.log(`🎯 Switch resolution completed:`, {
        resolvedCount: resolutionResult.resolvedSwitches.length,
        confidence: resolutionResult.confidence,
        method: resolutionResult.resolutionMethod,
        warnings: resolutionResult.warnings
      });

      // Check if we have enough switches for comparison
      // ENHANCED: More intelligent confidence filtering that considers AI fallback capabilities
      const highConfidenceSwitches = resolutionResult.resolvedSwitches.filter(
        (s) => s.confidence >= 0.5
      );
      const allResolvedSwitches = resolutionResult.resolvedSwitches;

      console.log(`✅ High confidence switches (>= 0.5): ${highConfidenceSwitches.length}`);
      console.log(`📊 Total resolved switches: ${allResolvedSwitches.length}`);
      console.log(`🎯 Overall resolution confidence: ${resolutionResult.confidence}`);

      // SMART LOGIC: Decide whether to use all switches or just high-confidence ones
      let validSwitches = highConfidenceSwitches;

      // If we have AI fallback capabilities and reasonable overall confidence, include all switches
      if (
        allResolvedSwitches.length >= 2 &&
        resolutionResult.confidence >= 0.6 &&
        highConfidenceSwitches.length >= 1
      ) {
        console.log(`🧠 AI fallback conditions met - including all resolved switches`);
        console.log(`   • Total switches: ${allResolvedSwitches.length} >= 2 ✅`);
        console.log(`   • Overall confidence: ${resolutionResult.confidence} >= 0.6 ✅`);
        console.log(`   • High confidence switches: ${highConfidenceSwitches.length} >= 1 ✅`);

        validSwitches = allResolvedSwitches; // Use ALL switches with AI fallback
      }

      console.log(
        `🎯 Final switches for comparison: ${validSwitches.length} (${validSwitches.map((s) => `${s.resolvedName}:${s.confidence}`).join(', ')})`
      );

      // NEW: Check if this is a material-based comparison when no specific switches found
      if (validSwitches.length < 2) {
        console.log(`🔍 Checking for material-based comparison intent...`);

        // Extract material comparison intent from resolution result
        const intentResult = resolutionResult.intentParseResult;
        console.log(`📊 Intent analysis:`, {
          comparisonType: intentResult?.queryContext?.comparisonType,
          preferences: intentResult?.queryContext?.preferences,
          confidence: intentResult?.confidence
        });

        if (
          intentResult?.queryContext?.comparisonType === 'materials' &&
          intentResult?.queryContext?.preferences &&
          intentResult.queryContext.preferences.length >= 2
        ) {
          console.log(`🧪 Material comparison detected - starting comprehensive analysis...`);
          const materialPreferences = intentResult.queryContext.preferences;

          try {
            return await this.materialComparisonService.processMaterialComparison(
              materialPreferences,
              userQuery,
              intentResult.confidence
            );
          } catch (materialError) {
            console.warn('Failed to process material comparison:', materialError);
            // Continue to regular insufficient switches logic
          }
        }

        // NEW: Check if this is a characteristics-based comparison (like smooth vs clicky)
        // Enhanced detection: check preferences OR extract from intendedSwitches
        let characteristicsToAnalyze: string[] = [];

        if (intentResult?.queryContext?.comparisonType === 'characteristics') {
          console.log(`🎯 Characteristics comparison type detected`);

          // Method 1: Use preferences if available
          if (
            intentResult?.queryContext?.preferences &&
            intentResult.queryContext.preferences.length >= 2
          ) {
            characteristicsToAnalyze = intentResult.queryContext.preferences;
            console.log(`📋 Using preferences array: ${characteristicsToAnalyze.join(', ')}`);
          }
          // Method 2: Extract characteristics from intendedSwitches
          else if (intentResult?.intendedSwitches && intentResult.intendedSwitches.length >= 2) {
            characteristicsToAnalyze = this.extractCharacteristicsFromSwitchNames(
              intentResult.intendedSwitches
            );
            console.log(
              `🔍 Extracted characteristics from intended switches: ${characteristicsToAnalyze.join(', ')}`
            );
          }
          // Method 3: Extract from the resolved switches themselves
          else if (resolutionResult.resolvedSwitches.length >= 1) {
            characteristicsToAnalyze = this.extractCharacteristicsFromQuery(userQuery);
            console.log(
              `🎯 Extracted characteristics from user query: ${characteristicsToAnalyze.join(', ')}`
            );
          }
        }

        // If we have characteristics to analyze, proceed with characteristics explanation
        if (characteristicsToAnalyze.length >= 2) {
          console.log(`🎯 Characteristics explanation detected - starting AI-powered analysis...`);
          console.log(`📚 Characteristics to explain: ${characteristicsToAnalyze.join(' vs ')}`);

          try {
            return await this.characteristicsComparisonService.processCharacteristicsComparison(
              characteristicsToAnalyze,
              userQuery,
              Math.max(intentResult?.confidence || 0.8, 0.85) // Boost confidence for characteristics
            );
          } catch (characteristicsError) {
            console.warn('Failed to process characteristics comparison:', characteristicsError);
            // Continue to enhanced fallback logic below
          }
        }

        // ENHANCED: Even with insufficient database matches, try characteristics explanation
        if (
          intentResult?.queryContext?.comparisonType === 'characteristics' ||
          this.isLikelyCharacteristicsQuery(userQuery)
        ) {
          console.log(
            `🧠 Detected characteristics query even with insufficient DB matches - using AI knowledge`
          );

          const extractedCharacteristics = this.extractCharacteristicsFromQuery(userQuery);
          if (extractedCharacteristics.length >= 2) {
            console.log(
              `🎓 Proceeding with AI-powered characteristics explanation: ${extractedCharacteristics.join(' vs ')}`
            );

            try {
              return await this.characteristicsComparisonService.processCharacteristicsComparison(
                extractedCharacteristics,
                userQuery,
                0.85 // High confidence for AI-powered characteristics explanation
              );
            } catch (error) {
              console.warn('AI-powered characteristics explanation failed:', error);
              // Continue to traditional error handling
            }
          }
        }

        console.log(`⚠️ Insufficient valid switches for comparison`);

        // NEW: Check for partial AI fallback opportunity
        // If we have at least 1 valid switch and some resolved switches, try partial AI fallback
        if (validSwitches.length >= 1 && resolutionResult.resolvedSwitches.length >= 2) {
          console.log(
            `🤖 Attempting partial AI fallback with ${validSwitches.length} database switch(es) and ${resolutionResult.resolvedSwitches.length - validSwitches.length} AI switch(es)`
          );

          // Extract all requested switches from resolution result
          const allRequestedSwitches = resolutionResult.resolvedSwitches.map((s) => s.resolvedName);

          return {
            isValidComparison: true,
            switchesToCompare: allRequestedSwitches, // Include ALL switches for AI fallback
            confidence: resolutionResult.confidence,
            originalQuery: userQuery,
            resolutionResult,
            processingNote: `Partial AI fallback: ${validSwitches.length} database + ${allRequestedSwitches.length - validSwitches.length} AI knowledge`
          };
        }

        // If no AI fallback possible, provide user feedback
        let userFeedbackMessage = "I couldn't identify enough switches for a comparison. ";

        if (validSwitches.length === 1) {
          userFeedbackMessage += `I found "${validSwitches[0].resolvedName}" but need at least one more switch to compare. `;
        }

        if (resolutionResult.warnings.length > 0) {
          userFeedbackMessage +=
            '\n\nIssues detected:\n' + resolutionResult.warnings.map((w) => `• ${w}`).join('\n');
        }

        userFeedbackMessage +=
          "\n\nCould you please specify which switches you'd like me to compare? You can use full names like 'Cherry MX Red' or 'Gateron Oil King'.";

        return {
          isValidComparison: false,
          switchesToCompare: validSwitches.map((s) => s.resolvedName),
          userFeedbackMessage,
          confidence: resolutionResult.confidence,
          originalQuery: userQuery,
          resolutionResult,
          processingNote: `Resolution method: ${resolutionResult.resolutionMethod}`
        };
      }

      // Successful resolution
      console.log(`🎉 Successful resolution - returning valid comparison request`);
      return {
        isValidComparison: true,
        switchesToCompare: validSwitches.map((s) => s.resolvedName),
        confidence: resolutionResult.confidence,
        originalQuery: userQuery,
        resolutionResult,
        processingNote: `Resolved ${validSwitches.length} switches using ${resolutionResult.resolutionMethod} method`
      };
    } catch (error) {
      console.error('❌ Enhanced comparison processing failed:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');

      // Fallback to legacy comparison processing
      console.log(`🔄 Falling back to legacy comparison processing...`);
      return this.processComparisonQuery(userQuery);
    }
  }

  /**
   * Public method to process comparison queries
   * Integrates comparison detection and variable switch handling
   */
  async processComparisonQuery(userQuery: string): Promise<ProcessedComparisonRequest> {
    // Use enhanced comparison processing directly
    return this.processEnhancedComparison(userQuery);
  }

  /**
   * Specialized data retrieval for switch comparisons
   * Fetches complete records for each identified switch instead of using general RAG
   */
  private async retrieveComprehensiveSwitchData(
    switchNames: string[]
  ): Promise<ComparisonDataRetrievalResult> {
    return this.dataRetrievalService.retrieveComprehensiveSwitchData(switchNames);
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
    return this.dataRetrievalService.formatMissingDataForPrompt(retrievalResult);
  }

  /**
   * Build educational prompt for characteristics explanation
   */
  private buildCharacteristicsEducationPrompt(
    historyForPrompt: Pick<UIChatMessage, 'role' | 'content'>[],
    userQuery: string,
    characteristicsExamples: Record<string, any[]>,
    processingNote: string
  ): string {
    // Build examples section
    let examplesSection = '';
    for (const [characteristic, switches] of Object.entries(characteristicsExamples)) {
      if (switches.length > 0) {
        examplesSection += `\n**${characteristic.toUpperCase()} EXAMPLES:**\n`;
        switches.forEach((sw: any) => {
          examplesSection += `- ${sw.name} (${sw.manufacturer}) - ${sw.type || 'Unknown type'}${sw.actuationForce ? `, ${sw.actuationForce}g` : ''}\n`;
        });
      }
    }

    const characteristics = Object.keys(characteristicsExamples);

    return `You are a mechanical keyboard expert providing EDUCATIONAL CONTENT about switch characteristics. The user wants to understand the differences between: ${characteristics.join(' vs ')}.

User query: "${userQuery}"

IMPORTANT: This is NOT a detailed switch comparison. Focus on EXPLAINING THE CHARACTERISTICS THEMSELVES - what they mean, how they're achieved, what materials/mechanisms create these effects, and how they affect the typing experience.

Example switches from our database (use these as brief illustrations, not detailed comparisons):
${examplesSection}

Structure your response as an educational guide:

## Understanding ${characteristics.join(' vs ')} Characteristics

### What Makes a Switch "${characteristics[0]}"?
[Explain the characteristic - materials, mechanisms, design principles]

### What Makes a Switch "${characteristics[1] || 'Different'}"?
[Explain the characteristic - materials, mechanisms, design principles]

### Material Science & Engineering:
[Explain how housing materials (PC, nylon, POM), stem materials, spring weights, etc. contribute to these characteristics]

### Sound & Feel Differences:
[Explain how these characteristics translate to actual typing experience]

### Illustrative Examples:
[Brief mentions of the example switches to demonstrate points, not detailed comparisons]

### Choosing Between These Characteristics:
[Practical advice for different use cases - gaming, typing, office, etc.]

Focus on EDUCATION about the characteristics themselves. Keep switch mentions brief and illustrative. The goal is to help the user understand what these terms mean and how they're achieved in switch design.`;
  }

  /**
   * Build educational prompt for material explanation
   */
  private buildMaterialEducationPrompt(
    historyForPrompt: Pick<UIChatMessage, 'role' | 'content'>[],
    userQuery: string,
    materialsToExplain: string[],
    materialExamples: Record<string, any[]>,
    processingNote: string
  ): string {
    // Build examples section
    let examplesSection = '';
    for (const [material, switches] of Object.entries(materialExamples)) {
      if (switches.length > 0) {
        examplesSection += `\n**${material.toUpperCase()} EXAMPLES:**\n`;
        switches.forEach((sw: any) => {
          const housingInfo = [];
          if (sw.topHousing) housingInfo.push(`Top: ${sw.topHousing}`);
          if (sw.bottomHousing) housingInfo.push(`Bottom: ${sw.bottomHousing}`);
          if (sw.stem) housingInfo.push(`Stem: ${sw.stem}`);

          examplesSection += `- ${sw.name} (${sw.manufacturer})${sw.type ? ` - ${sw.type}` : ''}${sw.actuationForce ? `, ${sw.actuationForce}g` : ''}`;
          if (housingInfo.length > 0) {
            examplesSection += ` [${housingInfo.join(', ')}]`;
          }
          examplesSection += '\n';
        });
      }
    }

    const historyContext =
      historyForPrompt.length > 0
        ? `## Previous Conversation:\n${historyForPrompt.map((msg) => `**${msg.role}:** ${msg.content}`).join('\n\n')}\n\n`
        : '';

    return `You are a mechanical keyboard expert providing EDUCATIONAL CONTENT about switch housing materials. The user wants to understand the differences between: ${materialsToExplain.join(' vs ')}.

${historyContext}User query: "${userQuery}"

IMPORTANT: This is NOT a detailed switch comparison. Focus on EXPLAINING THE MATERIALS THEMSELVES - what they are, their properties, how they affect sound and feel, and their impact on the typing experience.

Example switches from our database (use these as brief illustrations, not detailed comparisons):
${examplesSection}

Structure your response as an educational guide:

## Understanding ${materialsToExplain.join(' vs ')} Housing Materials

### ${materialsToExplain[0]} Properties:
[Explain the material - chemical composition, physical properties, manufacturing considerations]
- **Sound Profile:** [How this material affects sound - frequency response, resonance, dampening]
- **Feel Characteristics:** [How this material affects typing feel - firmness, texture, feedback]
- **Manufacturing:** [How this material is processed and its implications]
- **Use Cases:** [When this material is preferred and why]

### ${materialsToExplain[1] || 'Alternative Material'} Properties:
[Explain the material - chemical composition, physical properties, manufacturing considerations]
- **Sound Profile:** [How this material affects sound - frequency response, resonance, dampening]
- **Feel Characteristics:** [How this material affects typing feel - firmness, texture, feedback]
- **Manufacturing:** [How this material is processed and its implications]
- **Use Cases:** [When this material is preferred and why]

### Material Science & Engineering:
[Explain the physics and engineering behind how these materials create different experiences]
- **Acoustic Properties:** [How molecular structure affects sound transmission and dampening]
- **Mechanical Properties:** [How material hardness, flexibility, and surface texture affect feel]
- **Durability & Longevity:** [How these materials age and wear over time]

### Sound & Feel Comparison:
[Direct comparison of how these materials create different typing experiences]
- **Sound Signature:** [Frequency response, resonance characteristics, volume levels]
- **Tactile Experience:** [Surface texture, thermal properties, feedback quality]
- **Performance Characteristics:** [Consistency, temperature stability, long-term performance]

### Real-World Applications:
[Brief mentions of the example switches to demonstrate material choices, not detailed comparisons]

### Choosing Between These Materials:
[Practical advice for different use cases - gaming, typing, office, sound preferences, etc.]

Focus on EDUCATION about the materials themselves and their impact on switch performance. Keep switch mentions brief and illustrative. The goal is to help the user understand material science and how it translates to typing experience.`;
  }

  /**
   * Build AI-powered comparison prompt when database switches aren't found
   * Leverages general AI knowledge about mechanical switches
   */
  private buildAIFallbackComparisonPrompt(
    historyForPrompt: Pick<UIChatMessage, 'role' | 'content'>[],
    requestedSwitches: string[],
    userQuery: string,
    resolutionResult?: SwitchResolutionResult
  ): string {
    return `
ROLE: You are a highly knowledgeable mechanical keyboard enthusiast and expert. Provide a detailed, technical comparison of the requested switches.

PREVIOUS CONVERSATION:
${historyForPrompt.map((msg) => `${msg.role}: ${msg.content}`).join('\n\n')}

USER QUERY: "${userQuery}"

REQUESTED SWITCHES: ${requestedSwitches.join(', ')}

INSTRUCTIONS:
- Provide a comprehensive technical comparison of these switches
- Focus on actual switch characteristics: feel, sound, materials, actuation force, use cases
- Include technical details about housing materials, stem materials, spring weights
- Provide practical recommendations based on different use cases (gaming, typing, office)
- Use enthusiast terminology appropriately (thocky, clacky, creamy, scratchy, etc.)
- Structure your response with clear sections and bullet points
- Do NOT mention database limitations or data availability
- Do NOT provide disclaimers about information accuracy
- Present information confidently as an expert would

Focus on delivering valuable technical insights and practical guidance for mechanical keyboard enthusiasts.
`;
  }

  /**
   * Build partial AI fallback prompt for when we have some switches from DB and some missing
   * Combines database information with AI knowledge
   */
  private buildPartialAIFallbackPrompt(
    historyForPrompt: Pick<UIChatMessage, 'role' | 'content'>[],
    foundSwitch: any,
    missingSwitches: string[],
    userQuery: string,
    resolutionResult?: SwitchResolutionResult
  ): string {
    return `
ROLE: You are a highly knowledgeable mechanical keyboard enthusiast and expert. Provide a detailed comparison using both database information and your expert knowledge.

PREVIOUS CONVERSATION:
${historyForPrompt.map((msg) => `${msg.role}: ${msg.content}`).join('\n\n')}

USER QUERY: "${userQuery}"

DATABASE INFORMATION AVAILABLE:
**${foundSwitch.name}** (${foundSwitch.manufacturer})
- Type: ${foundSwitch.type || 'Not specified'}
- Actuation Force: ${foundSwitch.actuationForce ? foundSwitch.actuationForce + 'g' : 'Not specified'}
- Top Housing: ${foundSwitch.topHousing || 'Not specified'}
- Bottom Housing: ${foundSwitch.bottomHousing || 'Not specified'}
- Stem: ${foundSwitch.stem || 'Not specified'}
- Description: ${foundSwitch.description || 'No description available'}

SWITCHES TO ANALYZE FROM KNOWLEDGE: ${missingSwitches.join(', ')}

INSTRUCTIONS:
- Provide a comprehensive technical comparison including both the database switch and the other switches
- Use the detailed database information for ${foundSwitch.name} as a reference point
- Apply your expert knowledge for the other switches: ${missingSwitches.join(', ')}
- Focus on technical characteristics: feel, sound, materials, actuation force, use cases
- Include practical recommendations based on different use cases (gaming, typing, office)
- Use enthusiast terminology appropriately (thocky, clacky, creamy, scratchy, etc.)
- Structure your response with clear sections comparing all switches
- Do NOT mention database limitations or data availability
- Do NOT provide disclaimers about information accuracy
- Present all information confidently as an expert comparison

Focus on delivering valuable technical insights and practical guidance for mechanical keyboard enthusiasts.
`;
  }

  /**
   * Extract characteristics from switch names (e.g., "smooth switches" -> "smooth")
   */
  private extractCharacteristicsFromSwitchNames(switchNames: string[]): string[] {
    const characteristics: string[] = [];

    for (const switchName of switchNames) {
      const name = switchName.toLowerCase();

      if (name.includes('smooth') || name.includes('linear')) {
        characteristics.push('smooth');
      } else if (name.includes('clicky') || name.includes('click')) {
        characteristics.push('clicky');
      } else if (name.includes('tactile') || name.includes('bump')) {
        characteristics.push('tactile');
      } else if (name.includes('silent') || name.includes('quiet')) {
        characteristics.push('silent');
      } else if (name.includes('heavy') || name.includes('light')) {
        characteristics.push(name.includes('heavy') ? 'heavy' : 'light');
      } else if (name.includes('fast') || name.includes('responsive')) {
        characteristics.push('fast');
      }
    }

    return [...new Set(characteristics)]; // Remove duplicates
  }

  /**
   * Extract characteristics from user query text
   */
  private extractCharacteristicsFromQuery(query: string): string[] {
    const characteristics: string[] = [];
    const queryLower = query.toLowerCase();

    // Common characteristic patterns
    const characteristicPatterns = [
      { patterns: ['smooth', 'linear', 'butter'], characteristic: 'smooth' },
      { patterns: ['clicky', 'click', 'loud'], characteristic: 'clicky' },
      { patterns: ['tactile', 'bump', 'feedback'], characteristic: 'tactile' },
      { patterns: ['silent', 'quiet', 'dampened'], characteristic: 'silent' },
      { patterns: ['heavy', 'stiff', 'resistance'], characteristic: 'heavy' },
      { patterns: ['light', 'easy', 'effortless'], characteristic: 'light' },
      { patterns: ['fast', 'quick', 'responsive'], characteristic: 'fast' },
      { patterns: ['thocky', 'deep', 'muted'], characteristic: 'thocky' },
      { patterns: ['scratchy', 'rough', 'gritty'], characteristic: 'scratchy' }
    ];

    for (const { patterns, characteristic } of characteristicPatterns) {
      if (patterns.some((pattern) => queryLower.includes(pattern))) {
        characteristics.push(characteristic);
      }
    }

    return [...new Set(characteristics)]; // Remove duplicates
  }

  /**
   * Detect if a query is likely asking about characteristics rather than specific switches
   */
  private isLikelyCharacteristicsQuery(query: string): boolean {
    const queryLower = query.toLowerCase();

    // Characteristic comparison keywords
    const characteristicKeywords = [
      'smooth vs',
      'clicky vs',
      'tactile vs',
      'silent vs',
      'linear vs',
      'compare smooth',
      'compare clicky',
      'compare tactile',
      'difference between smooth',
      'difference between clicky',
      'smooth or clicky',
      'linear or tactile',
      'quiet or loud'
    ];

    return characteristicKeywords.some((keyword) => queryLower.includes(keyword));
  }

  /** Full RAG-powered message processing */
  async processMessage(userId: string, request: ChatRequest): Promise<ChatResponse> {
    const rawUserQuery = this.truncateText(request.message, AI_CONFIG.MAX_OUTPUT_TOKENS * 100);

    try {
      console.log(`🔍 Processing message: "${rawUserQuery}"`);

      // Step 0: Detect if this is a comparison request
      const comparisonIntent = await this.detectComparisonIntent(rawUserQuery);
      console.log(`🎯 Comparison intent detected:`, {
        isComparison: comparisonIntent.isComparison,
        confidence: comparisonIntent.confidence,
        extractedSwitches: comparisonIntent.extractedSwitchNames
      });

      // 1) Get or create conversation
      let conversation = await withDb(async () => {
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
      console.log(`💬 Conversation ID: ${currentConversationId}`);

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
      console.log(`💾 User message saved`);

      // ROUTE DECISION: Comparison vs Standard RAG
      if (comparisonIntent.isComparison) {
        // ** COMPARISON FLOW **
        console.log(
          `🔧 Entering enhanced comparison flow with confidence: ${comparisonIntent.confidence}`
        );

        try {
          // Process the comparison request through our complete comparison pipeline
          console.log(`⚙️ Calling processEnhancedComparison...`);
          const comparisonRequest = await this.processEnhancedComparison(rawUserQuery);
          console.log(`✅ processEnhancedComparison completed:`, {
            isValid: comparisonRequest.isValidComparison,
            switchesToCompare: comparisonRequest.switchesToCompare,
            confidence: comparisonRequest.confidence,
            processingNote: comparisonRequest.processingNote
          });

          if (!comparisonRequest.isValidComparison) {
            // Handle invalid comparison (e.g., insufficient switches, user feedback needed)
            console.log(`⚠️ Invalid comparison request - providing user feedback`);
            const assistantText =
              comparisonRequest.userFeedbackMessage ||
              "I couldn't identify enough switches for a comparison. Could you please specify which switches you'd like me to compare?";

            // Save assistant response
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

            // Update conversation timestamp
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

          // ENHANCED: Handle characteristics explanations directly without data retrieval
          if (
            comparisonRequest.isCharacteristicsExplanation &&
            comparisonRequest.characteristicsExamples
          ) {
            console.log(
              `🎓 Characteristics explanation detected - generating educational content directly`
            );
            console.log(
              `📚 Example switches already gathered: ${Object.values(comparisonRequest.characteristicsExamples).flat().length} total examples`
            );

            try {
              // Get conversation history
              const historyForPrompt =
                await this.getConversationHistoryForPrompt(currentConversationId);

              // Build educational characteristics prompt using the pre-gathered examples
              const prompt = this.buildCharacteristicsEducationPrompt(
                historyForPrompt,
                rawUserQuery,
                comparisonRequest.characteristicsExamples,
                comparisonRequest.processingNote || ''
              );

              // Generate educational content using Gemini
              const assistantText = await geminiService.generate(prompt);

              // Check if Gemini returned a fallback error message
              if (assistantText === AI_CONFIG.FALLBACK_ERROR_MESSAGE_LLM) {
                const fallbackText = `I apologize, but I'm having trouble generating the characteristics explanation right now. This could be due to AI service limitations. Please try again in a moment.`;

                const [assistantMsgRecord] = await db
                  .insert(messagesTable)
                  .values({
                    conversationId: currentConversationId,
                    userId,
                    content: fallbackText,
                    role: 'assistant',
                    metadata: {
                      model: AI_CONFIG.GEMINI_MODEL,
                      isComparison: true,
                      comparisonValid: true,
                      error: 'llm_generation_failure_characteristics',
                      characteristicsExplanation: true
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
                  content: fallbackText,
                  metadata: assistantMsgRecord.metadata as Record<string, any>
                };
              }

              // Save successful characteristics explanation
              const [assistantMsgRecord] = await db
                .insert(messagesTable)
                .values({
                  conversationId: currentConversationId,
                  userId,
                  content: assistantText,
                  role: 'assistant',
                  metadata: {
                    model: AI_CONFIG.GEMINI_MODEL,
                    isComparison: false, // This is education, not comparison
                    comparisonValid: true,
                    comparisonConfidence: comparisonRequest.confidence,
                    characteristicsExplanation: true,
                    educationalContent: true,
                    processingNote: comparisonRequest.processingNote,
                    promptLength: prompt.length,
                    exampleSwitchesCount: Object.values(
                      comparisonRequest.characteristicsExamples
                    ).flat().length
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
            } catch (error) {
              console.error(`❌ Characteristics explanation generation failed:`, error);
              // Continue to fallback logic below
            }
          }

          // ENHANCED: Handle material explanations directly without switch data retrieval
          if (comparisonRequest.isMaterialsExplanation && comparisonRequest.materialExamples) {
            console.log(
              `🧪 Material explanation detected - generating educational content directly`
            );
            console.log(
              `📚 Example switches already gathered: ${Object.values(comparisonRequest.materialExamples).flat().length} total examples`
            );

            try {
              // Get conversation history
              const historyForPrompt =
                await this.getConversationHistoryForPrompt(currentConversationId);

              // Build educational material prompt using the pre-gathered examples
              const prompt = this.buildMaterialEducationPrompt(
                historyForPrompt,
                rawUserQuery,
                comparisonRequest.materialsToExplain || [],
                comparisonRequest.materialExamples,
                comparisonRequest.processingNote || ''
              );

              // Generate educational content using Gemini
              const assistantText = await geminiService.generate(prompt);

              // Check if Gemini returned a fallback error message
              if (assistantText === AI_CONFIG.FALLBACK_ERROR_MESSAGE_LLM) {
                const fallbackText = `I apologize, but I'm having trouble generating the material explanation right now. This could be due to AI service limitations. Please try again in a moment.`;

                const [assistantMsgRecord] = await db
                  .insert(messagesTable)
                  .values({
                    conversationId: currentConversationId,
                    userId,
                    content: fallbackText,
                    role: 'assistant',
                    metadata: {
                      model: AI_CONFIG.GEMINI_MODEL,
                      isComparison: true,
                      comparisonValid: true,
                      error: 'llm_generation_failure_materials',
                      materialExplanation: true
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
                  content: fallbackText,
                  metadata: assistantMsgRecord.metadata as Record<string, any>
                };
              }

              // Save successful material explanation
              const [assistantMsgRecord] = await db
                .insert(messagesTable)
                .values({
                  conversationId: currentConversationId,
                  userId,
                  content: assistantText,
                  role: 'assistant',
                  metadata: {
                    model: AI_CONFIG.GEMINI_MODEL,
                    isComparison: false, // This is education, not comparison
                    comparisonValid: true,
                    comparisonConfidence: comparisonRequest.confidence,
                    materialExplanation: true,
                    educationalContent: true,
                    processingNote: comparisonRequest.processingNote,
                    promptLength: prompt.length,
                    exampleSwitchesCount: Object.values(comparisonRequest.materialExamples).flat()
                      .length
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
            } catch (error) {
              console.error(`❌ Material explanation generation failed:`, error);
              // Continue to fallback logic below
            }
          }

          // Valid comparison - proceed with embedding-based data retrieval
          console.log(
            `🎯 Valid comparison confirmed - proceeding with data retrieval for ${comparisonRequest.switchesToCompare.length} switches`
          );
          console.log(`📋 Switches to retrieve: ${comparisonRequest.switchesToCompare.join(', ')}`);

          let retrievalResult: ComparisonDataRetrievalResult;
          try {
            console.log(`🔍 Calling retrieveComprehensiveSwitchData...`);
            retrievalResult = await this.retrieveComprehensiveSwitchData(
              comparisonRequest.switchesToCompare
            );
            console.log(`✅ Data retrieval completed:`, {
              allSwitchesFound: retrievalResult.allSwitchesFound,
              foundSwitches: retrievalResult.switchesData.filter((s) => s.isFound).length,
              missingSwitches: retrievalResult.missingSwitches.length,
              hasDataGaps: retrievalResult.hasDataGaps
            });
          } catch (retrievalError) {
            console.error('❌ Critical failure in switch data retrieval:', retrievalError);
            console.error(
              '❌ Retrieval error stack:',
              retrievalError instanceof Error ? retrievalError.stack : 'No stack trace'
            );
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

          // Check if we have enough data to proceed with comparison
          console.log(`🔍 Analyzing retrieval results...`);
          const foundSwitches = retrievalResult.switchesData.filter((s) => s.isFound);
          console.log(
            `📊 Analysis: ${foundSwitches.length} found switches, ${retrievalResult.missingSwitches.length} missing switches`
          );
          console.log(
            `📋 Found switches:`,
            foundSwitches.map((s) => s.name)
          );
          console.log(`❌ Missing switches:`, retrievalResult.missingSwitches);

          if (foundSwitches.length === 0) {
            console.log(
              `⚠️ No switches found in database - checking if this is characteristics explanation...`
            );

            // UNIVERSAL AI FALLBACK: Use AI knowledge for any comparison when database fails
            console.log(`🧠 Universal AI fallback - leveraging AI knowledge for comparison`);
            console.log(`📋 Requested switches: ${comparisonRequest.switchesToCompare.join(', ')}`);

            try {
              const historyForPrompt =
                await this.getConversationHistoryForPrompt(currentConversationId);

              // Build AI-powered comparison prompt that leverages general knowledge
              const aiPrompt = this.buildAIFallbackComparisonPrompt(
                historyForPrompt,
                comparisonRequest.switchesToCompare,
                rawUserQuery,
                comparisonRequest.resolutionResult
              );

              // Generate AI-powered response
              const assistantText = await geminiService.generate(aiPrompt);

              // Check if Gemini returned a fallback error message
              if (assistantText === AI_CONFIG.FALLBACK_ERROR_MESSAGE_LLM) {
                const fallbackText = `I apologize, but I'm having trouble generating information about ${comparisonRequest.switchesToCompare.join(' and ')} right now. This could be due to AI service limitations. Please try again in a moment.`;

                const [assistantMsgRecord] = await db
                  .insert(messagesTable)
                  .values({
                    conversationId: currentConversationId,
                    userId,
                    content: fallbackText,
                    role: 'assistant',
                    metadata: {
                      model: AI_CONFIG.GEMINI_MODEL,
                      isComparison: true,
                      comparisonValid: false,
                      error: 'llm_generation_failure_ai_fallback',
                      aiFallbackAttempted: true
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
                  content: fallbackText,
                  metadata: assistantMsgRecord.metadata as Record<string, any>
                };
              }

              // Save successful AI fallback response
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
                    comparisonValid: true,
                    comparisonConfidence: comparisonRequest.confidence,
                    aiFallback: true,
                    noDatabase: true,
                    requestedSwitches: comparisonRequest.switchesToCompare,
                    resolutionMethod: comparisonRequest.resolutionResult?.resolutionMethod,
                    processingNote: comparisonRequest.processingNote,
                    promptLength: aiPrompt.length
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
            } catch (aiFallbackError) {
              console.error('❌ AI fallback failed:', aiFallbackError);
              // Continue to legacy error handling
            }

            // Legacy error message - only as final fallback
            console.log(`⚠️ All fallback options exhausted - returning legacy error response`);
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
            console.log(`⚠️ Only 1 switch found - handling single switch case`);
            const foundSwitch = foundSwitches[0];
            console.log(`📝 Found switch details:`, {
              name: foundSwitch.name,
              manufacturer: foundSwitch.manufacturer,
              type: foundSwitch.type
            });

            // ENHANCED: Try AI fallback for missing switches
            console.log(`🧠 Attempting AI fallback for missing switches...`);

            try {
              const historyForPrompt =
                await this.getConversationHistoryForPrompt(currentConversationId);

              // Build prompt that combines the found switch with AI knowledge about missing ones
              const enhancedPrompt = this.buildPartialAIFallbackPrompt(
                historyForPrompt,
                foundSwitch,
                retrievalResult.missingSwitches,
                rawUserQuery,
                comparisonRequest.resolutionResult
              );

              // Generate enhanced response with both database and AI knowledge
              const assistantText = await geminiService.generate(enhancedPrompt);

              // Check if Gemini returned a fallback error message
              if (assistantText === AI_CONFIG.FALLBACK_ERROR_MESSAGE_LLM) {
                // Fall back to legacy single switch message
                const fallbackText =
                  `I could only find "${foundSwitch.name}" from your comparison request. For a meaningful comparison, I need at least two switches from our database.\n\n` +
                  `${retrievalResult.missingSwitches.length > 0 ? `I couldn't find: ${retrievalResult.missingSwitches.join(', ')}\n\n` : ''}` +
                  `Would you like me to:\n• Provide detailed information about ${foundSwitch.name}\n• Suggest similar switches to compare with ${foundSwitch.name}\n• Help you find the correct names for the other switches?`;

                console.log(`💾 Saving fallback single switch response to database...`);
                const [assistantMsgRecord] = await db
                  .insert(messagesTable)
                  .values({
                    conversationId: currentConversationId,
                    userId,
                    content: fallbackText,
                    role: 'assistant',
                    metadata: {
                      model: AI_CONFIG.GEMINI_MODEL,
                      isComparison: true,
                      comparisonValid: false,
                      error: 'insufficient_switches_found',
                      foundSwitches: [foundSwitch.name],
                      missingSwitches: retrievalResult.missingSwitches,
                      aiFallbackAttempted: true,
                      aiFallbackFailed: true
                    },
                    createdAt: new Date(),
                    timestamp: new Date()
                  })
                  .returning();
                console.log(`✅ Fallback response saved with ID: ${assistantMsgRecord.id}`);

                await db
                  .update(conversations)
                  .set({ updatedAt: new Date() })
                  .where(eq(conversations.id, currentConversationId));

                return {
                  id: assistantMsgRecord.id,
                  role: 'assistant',
                  content: fallbackText,
                  metadata: assistantMsgRecord.metadata as Record<string, any>
                };
              }

              // Save successful enhanced response
              console.log(`💾 Saving enhanced single switch + AI response to database...`);
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
                    comparisonValid: true,
                    comparisonConfidence: comparisonRequest.confidence,
                    foundSwitches: [foundSwitch.name],
                    missingSwitches: retrievalResult.missingSwitches,
                    enhancedWithAI: true,
                    partialDatabase: true,
                    promptLength: enhancedPrompt.length
                  },
                  createdAt: new Date(),
                  timestamp: new Date()
                })
                .returning();
              console.log(`✅ Enhanced response saved with ID: ${assistantMsgRecord.id}`);

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
            } catch (aiError) {
              console.error('❌ AI enhancement for single switch failed:', aiError);
              // Fall back to original single switch logic
            }

            // Original single switch logic as final fallback
            const assistantText =
              `I could only find "${foundSwitch.name}" from your comparison request. For a meaningful comparison, I need at least two switches from our database.\n\n` +
              `${retrievalResult.missingSwitches.length > 0 ? `I couldn't find: ${retrievalResult.missingSwitches.join(', ')}\n\n` : ''}` +
              `Would you like me to:\n• Provide detailed information about ${foundSwitch.name}\n• Suggest similar switches to compare with ${foundSwitch.name}\n• Help you find the correct names for the other switches?`;

            console.log(`💾 Saving single switch response to database...`);
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
            console.log(`✅ Single switch response saved with ID: ${assistantMsgRecord.id}`);

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

          // Format the data for the comparison prompt
          console.log(`🔧 Proceeding with comparison - formatting data for prompt...`);
          let formattedData: any;
          try {
            console.log(`📝 Calling formatMissingDataForPrompt...`);
            formattedData = this.formatMissingDataForPrompt(retrievalResult);
            console.log(`✅ Data formatting completed successfully`);
          } catch (formatError) {
            console.error('❌ Error formatting data for prompt:', formatError);
            console.error(
              '❌ Format error stack:',
              formatError instanceof Error ? formatError.stack : 'No stack trace'
            );
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

          // Get conversation history for the comparison prompt
          const historyForPrompt =
            await this.getConversationHistoryForPrompt(currentConversationId);

          // Build enhanced switch data with material context
          let enhancedSwitchData: EnhancedSwitchData[];
          let detectedUseCase: string | undefined;

          try {
            // Build enhanced switch data from retrieval results
            enhancedSwitchData = PromptBuilder.buildEnhancedSwitchData(
              comparisonRequest.switchesToCompare,
              formattedData.switchDataBlocks
            );

            // Detect use case from user query for context injection
            detectedUseCase = this.materialContextService.detectUseCase(rawUserQuery) || undefined;
          } catch (enhancementError) {
            console.warn(
              'Error building enhanced switch data, falling back to basic format:',
              enhancementError
            );
            // Fallback to basic format
            enhancedSwitchData = comparisonRequest.switchesToCompare.map((name, index) => ({
              name,
              dataBlock: formattedData.switchDataBlocks[index] || ''
            }));
          }

          // Build the enhanced comparison prompt with material context
          let comparisonPrompt: string;
          try {
            comparisonPrompt = PromptBuilder.buildEnhancedComparisonPrompt(
              historyForPrompt,
              enhancedSwitchData,
              formattedData.promptInstructions,
              rawUserQuery,
              comparisonRequest.switchesToCompare,
              detectedUseCase
            );
          } catch (promptError) {
            console.error('Error building enhanced comparison prompt:', promptError);

            // Fallback to legacy prompt builder
            try {
              comparisonPrompt = PromptBuilder.buildComparisonPrompt(
                historyForPrompt,
                formattedData.switchDataBlocks,
                formattedData.promptInstructions,
                rawUserQuery,
                comparisonRequest.switchesToCompare
              );
            } catch (fallbackError) {
              console.error('Even fallback prompt building failed:', fallbackError);
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
                      fallbackError instanceof Error
                        ? fallbackError.message
                        : 'Unknown prompt error'
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
          }

          // Generate comparison using Gemini (GeminiService has its own error handling)
          const assistantText = await geminiService.generate(comparisonPrompt);

          // Check if Gemini returned a fallback error message
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

          // Save successful assistant response with comprehensive metadata
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
                comparisonValid: true,
                comparisonConfidence: comparisonRequest.confidence,
                switchesCompared: comparisonRequest.switchesToCompare,
                switchesFoundInDB: foundSwitches.map((s) => s.name),
                missingSwitches: retrievalResult.missingSwitches,
                hasDataGaps: retrievalResult.hasDataGaps,
                promptLength: comparisonPrompt.length,
                retrievalNotes: retrievalResult.retrievalNotes,
                // Enhanced metadata
                resolutionMethod: comparisonRequest.resolutionResult?.resolutionMethod,
                resolutionWarnings: comparisonRequest.resolutionResult?.warnings,
                materialContextApplied: enhancedSwitchData.some((s) => s.materialData),
                detectedUseCase,
                enhancedComparison: true,
                processingNote: comparisonRequest.processingNote
              },
              createdAt: new Date(),
              timestamp: new Date()
            })
            .returning();

          // Update conversation timestamp
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
        // ** STANDARD RAG FLOW **
        const assistantText = await this.processStandardRAG(rawUserQuery, currentConversationId);

        // Save assistant response
        const [assistantMsgRecord] = await db
          .insert(messagesTable)
          .values({
            conversationId: currentConversationId,
            userId,
            content: assistantText,
            role: 'assistant',
            metadata: {
              model: AI_CONFIG.GEMINI_MODEL,
              isComparison: false
            },
            createdAt: new Date(),
            timestamp: new Date()
          })
          .returning();

        // Update conversation timestamp
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

  /**
   * Standard RAG processing (extracted from original processMessage)
   */
  private async processStandardRAG(
    rawUserQuery: string,
    currentConversationId: string
  ): Promise<string> {
    // 3) Embed the user query
    const queryEmbedding = await embeddingService.embedText(rawUserQuery);
    const queryEmbeddingSql = arrayToVector(queryEmbedding);

    // 4) Retrieve top-K context from switches table
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

    // 5) Fetch recent history
    const historyForPrompt = await this.getConversationHistoryForPrompt(currentConversationId);

    // 6) Build prompt using the new PromptBuilder and structured config
    const prompt = PromptBuilder.buildPrompt(
      historyForPrompt,
      switchContextsForPrompt,
      rawUserQuery
    );

    // 7) Call Gemini
    return await geminiService.generate(prompt);
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

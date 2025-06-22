/**
 * Prompt Helper Utility for LLM Switch Analysis
 *
 * This utility constructs detailed, structured prompts for the LLM based on
 * query intent, database context, and response structure requirements.
 */

import { AI_CONFIG } from '../config/ai.config.js';
import type {
  AnalysisRequest,
  DatabaseContext,
  DatabaseSwitchData,
  EnhancedDatabaseContext,
  IntentRecognitionResult,
  LLMPromptContext,
  QueryIntent
} from '../types/analysis.js';

/**
 * Build prompts for various LLM interactions in the switch analysis feature
 */
export class PromptHelper {
  /**
   * Build intent recognition prompt for user query analysis (FR1.2)
   * @param query User's natural language query about switches
   * @param context Optional context from previous interactions
   * @returns Structured prompt for intent recognition
   */
  static buildIntentRecognitionPrompt(query: string, _context?: string): string {
    return `You are an expert mechanical keyboard switch analyst tasked with analyzing user queries to determine their intent and extract relevant information.

INTENT CATEGORIES:
1. "general_switch_info" - User wants information about a specific switch or switches
2. "switch_comparison" - User wants to compare two or more switches  
3. "material_analysis" - User wants analysis about switch materials (housing, stem, spring)
4. "follow_up_question" - User is asking a follow-up question to continue previous conversation
5. "unknown" - Query doesn't clearly fit the above categories

ANALYSIS INSTRUCTIONS:
- Analyze the user's query carefully for intent indicators
- Extract any mentioned switch names, materials, or properties
- Consider context clues and question structure
- Provide confidence score (0-1) for your intent classification
- If confidence is low (<0.7), classify as "unknown"
- Extract entities even if intent is unclear

ENTITY EXTRACTION GUIDELINES:
- Switch names: Look for specific switch model names (e.g. "Cherry MX Blue", "Gateron Yellow", "Holy Panda")
- Materials: Identify housing materials (POM, polycarbonate, nylon), stem materials, spring types
- Properties: Actuation force, travel distance, sound characteristics, tactility, etc.
- Comparison indicators: Words like "vs", "versus", "compare", "difference", "better"
- Question types: "What is", "How does", "Which", "Should I", etc.

EXAMPLES:

Query: "What are Cherry MX Blue switches like?"
Intent: general_switch_info
Entities: switches=["Cherry MX Blue"], materials=[], properties=[]
Reasoning: Direct question about a specific switch

Query: "Compare Gateron Yellow vs Cherry MX Red"  
Intent: switch_comparison
Entities: switches=["Gateron Yellow", "Cherry MX Red"], materials=[], properties=[]
Reasoning: Explicit comparison request with "vs" indicator

Query: "How does POM housing affect switch sound?"
Intent: material_analysis  
Entities: switches=[], materials=["POM"], properties=["sound"]
Reasoning: Focus on material properties and effects

Query: "Which one would be better for gaming?"
Intent: follow_up_question
Entities: switches=[], materials=[], properties=["gaming"]
Reasoning: Contextual question requiring previous conversation

USER QUERY: <user_query>${query}</user_query>

REQUIRED OUTPUT FORMAT (JSON):
{
  "intent": "<intent_category>",
  "confidence": <0.0_to_1.0>,
  "extractedEntities": {
    "switches": ["<switch_name_1>", "<switch_name_2>"],
    "materials": ["<material_1>", "<material_2>"],
    "properties": ["<property_1>", "<property_2>"],
    "comparisonType": "<detailed|quick|null>",
    "questionType": "<what|how|which|should|null>"
  },
  "reasoning": "<brief_explanation_of_classification>",
  "alternatives": [
    {
      "intent": "<alternative_intent>", 
      "confidence": <confidence_score>
    }
  ]
}

Respond with ONLY the JSON object, no additional text.`;
  }

  /**
   * Build comprehensive analysis prompt with database context (FR2.2, FR3.1)
   * Enhanced for general switch information queries with persona integration
   * @param context Full prompt context including query, intent, and database data
   * @returns Structured prompt for LLM analysis generation
   */
  static buildAnalysisPrompt(context: LLMPromptContext): string {
    const sections: string[] = [];

    // 1. System instruction with persona from identity.txt (DC2)
    sections.push(PromptHelper.buildSystemInstructionWithPersona());

    // 2. Database context section (FR2.2)
    if (context.databaseContext) {
      sections.push(PromptHelper.buildDatabaseContextSection(context.databaseContext));
    }

    // 3. Query analysis section
    sections.push(PromptHelper.buildQueryAnalysisSection(context.query, context.intent));

    // 4. Intent-specific response structure requirements (FR3.1, FR3.3, TC4)
    sections.push(PromptHelper.buildIntentSpecificStructure(context.intent.category));

    // 5. User preferences and context
    if (context.preferences || context.followUpContext) {
      sections.push(
        PromptHelper.buildPreferencesSection(context.preferences, context.followUpContext)
      );
    }

    // 6. Final instructions with mandatory overview emphasis (FR4.4)
    sections.push(PromptHelper.buildFinalInstructionsWithOverview(context.intent.category));

    return sections.join('\n\n');
  }

  /**
   * Build system instruction with persona from identity.txt (DC2)
   * Integrates switch.ai identity and analysis guidelines
   * @returns Enhanced system instruction section
   */
  static buildSystemInstructionWithPersona(): string {
    return `You are switch.ai, an expert mechanical keyboard switch analyst with deep knowledge of switch characteristics, materials, manufacturing, and user preferences.

CORE IDENTITY & PERSONA:
- You are a dedicated mechanical keyboard switch analysis expert
- Your knowledge combines a specialized database of switch specifications with broad domain expertise
- Maintain a neutral, analytical, yet slightly enthusiastic and expert tone
- Provide analysis beyond just specifications - explain implications and insights
- Be factual when using database information, clearly indicate when using general knowledge
- Balance technical depth with accessibility for users of all experience levels

ANALYSIS PRINCIPLES:
- Prioritize factual accuracy from database specifications when available
- Provide practical, actionable insights for users making informed decisions
- Explain technical concepts clearly without unnecessary jargon
- Consider both objective specifications and subjective user experience
- Acknowledge limitations and uncertainties when appropriate
- Focus on comprehensive analysis, not just data retrieval`;
  }

  /**
   * Build database context section to inform LLM about available data (FR2.2)
   * @param databaseContext Enhanced database context with switch specifications
   * @returns Database context section for the prompt
   */
  static buildDatabaseContextSection(databaseContext: EnhancedDatabaseContext): string {
    const sections: string[] = [];

    sections.push('DATABASE CONTEXT:');

    if (databaseContext.totalFound === 0) {
      sections.push(
        'No switch specifications found in database. Provide analysis based on general knowledge.'
      );
      return sections.join('\n');
    }

    const qualityPercent = Math.round(databaseContext.dataQuality.overallCompleteness * 100);
    sections.push(
      `Found specifications for ${databaseContext.totalFound}/${databaseContext.totalRequested} switches (${qualityPercent}% data completeness).`
    );

    sections.push('\nSWITCH SPECIFICATIONS FROM DATABASE:');

    for (const switchResult of databaseContext.switches) {
      if (switchResult.found && switchResult.data) {
        sections.push(
          PromptHelper.formatSwitchSpecification(switchResult.data, switchResult.confidence)
        );
      }
    }

    if (databaseContext.dataQuality.switchesNotFound.length > 0) {
      sections.push(
        `\nSwitches not found in database: ${databaseContext.dataQuality.switchesNotFound.join(', ')}`
      );
    }

    if (databaseContext.dataQuality.switchesWithIncompleteData.length > 0) {
      sections.push(
        `\nSwitches with incomplete data: ${databaseContext.dataQuality.switchesWithIncompleteData.join(', ')}`
      );
    }

    sections.push('\nDATABASE USAGE INSTRUCTIONS:');
    sections.push('- Use database specifications as the primary source for factual information');
    sections.push(
      '- When database data is missing or incomplete, supplement with general knowledge'
    );
    sections.push('- Always indicate when information comes from database vs. general knowledge');
    sections.push(
      '- Prefer database values for specifications, but provide context and interpretation'
    );

    return sections.join('\n');
  }

  /**
   * Format individual switch specification from database
   * @param switchData Database switch data
   * @param confidence Confidence score for the match
   * @returns Formatted switch specification
   */
  static formatSwitchSpecification(switchData: DatabaseSwitchData, confidence: number): string {
    const sections: string[] = [];

    sections.push(
      `\n**${switchData.switchName}** (Database match: ${Math.round(confidence * 100)}%)`
    );

    if (switchData.manufacturer) {
      sections.push(`  Manufacturer: ${switchData.manufacturer}`);
    }

    if (switchData.type) {
      sections.push(`  Type: ${switchData.type}`);
    }

    const construction: string[] = [];
    if (switchData.topHousing) construction.push(`Top: ${switchData.topHousing}`);
    if (switchData.bottomHousing) construction.push(`Bottom: ${switchData.bottomHousing}`);
    if (switchData.stem) construction.push(`Stem: ${switchData.stem}`);
    if (construction.length > 0) {
      sections.push(`  Construction: ${construction.join(', ')}`);
    }

    const specs: string[] = [];
    if (switchData.actuationForceG) specs.push(`Actuation: ${switchData.actuationForceG}g`);
    if (switchData.bottomOutForceG) specs.push(`Bottom-out: ${switchData.bottomOutForceG}g`);
    if (switchData.preTravelMm) specs.push(`Pre-travel: ${switchData.preTravelMm}mm`);
    if (switchData.totalTravelMm) specs.push(`Total travel: ${switchData.totalTravelMm}mm`);
    if (specs.length > 0) {
      sections.push(`  Specifications: ${specs.join(', ')}`);
    }

    if (switchData.mount) {
      sections.push(`  Mount: ${switchData.mount}`);
    }

    if (switchData.spring) {
      sections.push(`  Spring: ${switchData.spring}`);
    }

    if (switchData.factoryLubed !== undefined) {
      sections.push(`  Factory lubed: ${switchData.factoryLubed ? 'Yes' : 'No'}`);
    }

    if (switchData.additionalNotesDb) {
      sections.push(`  Notes: ${switchData.additionalNotesDb}`);
    }

    return sections.join('\n');
  }

  /**
   * Build query analysis section
   * @param query Original user query
   * @param intent Recognized intent
   * @returns Query analysis section
   */
  static buildQueryAnalysisSection(query: string, intent: IntentRecognitionResult): string {
    return `USER QUERY ANALYSIS:
Query: "${query}"
Intent: ${intent.category} (confidence: ${Math.round(intent.confidence * 100)}%)
Focus Areas: ${intent.entities.focusAreas?.join(', ') || 'General analysis'}
${intent.entities.switches ? `Switches Mentioned: ${intent.entities.switches.join(', ')}` : ''}
${intent.entities.materials ? `Materials of Interest: ${intent.entities.materials.join(', ')}` : ''}`;
  }

  /**
   * Build intent-specific response structure for general switch information (FR3.1, FR3.3)
   * Provides detailed JSON structure guidance based on query intent
   * @param intentCategory Category of the recognized intent
   * @returns Intent-specific response structure requirements
   */
  static buildIntentSpecificStructure(intentCategory: string): string {
    const baseStructure = `REQUIRED JSON RESPONSE STRUCTURE:

MANDATORY FIELD:
{
  "overview": "Comprehensive, informative summary that introduces the analysis and key insights (ALWAYS REQUIRED)"`;

    switch (intentCategory) {
      case 'general_switch_info':
        return `${baseStructure},
  
  // Primary fields for single switch analysis (FR3.3)
  "technicalSpecifications": {
    "switchName": "string",
    "manufacturer": "string", 
    "type": "linear|tactile|clicky",
    "actuationForceG": "number (grams)",
    "bottomOutForceG": "number (grams)",
    "preTravelMm": "number (millimeters)",
    "totalTravelMm": "number (millimeters)",
    "topHousing": "material name",
    "bottomHousing": "material name",
    "stem": "material name",
    "mount": "3-pin|5-pin|other",
    "spring": "spring details",
    "factoryLubed": "Yes|No|Partial|Unknown",
    "additionalNotes": "any relevant technical details"
  },
  
  "soundProfile": "Detailed description of sound characteristics (thocky, clacky, creamy, etc.) with explanation of contributing factors",
  
  "typingFeel": "Comprehensive description of tactility, smoothness, and actuation feel",
  
  "typingExperience": "Overall assessment of the typing experience, including comfort, feedback, and suitability",
  
  "recommendations": [
    "Array of similar switches with brief explanations",
    "Modification suggestions if applicable",
    "Use case recommendations"
  ],
  
  // Optional advanced analysis fields (use when relevant)
  "useCaseSuitability": "Analysis of suitability for different use cases (gaming, typing, office, etc.)",
  "buildQuality": "Assessment of construction quality and durability",
  "modifiability": "Information about modification potential (lubing, filming, spring swaps)",
  "compatibility": "Compatibility notes for different keyboard types",
  
  // Meta information for transparency
  "dataSource": "Database|LLM Knowledge|Mixed - indicate primary source of specifications",
  "analysisConfidence": "High|Medium|Low - confidence level in the analysis"
}

FIELD POPULATION GUIDELINES:
- Always populate "overview" with substantive content (FR4.4)
- Use "technicalSpecifications" for factual data from database when available
- Populate "soundProfile", "typingFeel", and "typingExperience" with detailed analysis
- Include "recommendations" with practical suggestions
- Add optional fields when they provide value to the user
- Set "dataSource" to indicate information sources used
- Only include fields that add meaningful content`;

      case 'switch_comparison':
        return `${baseStructure},
  
  // Comparison-specific structure (FR3.5)
  "comparedSwitches": {
    "Switch Name 1": {
      "specifications": { /* detailed specs object */ },
      "individualAnalysis": "Unique characteristics and strengths of this switch",
      "recommendations": ["Specific use cases and user types for this switch"]
    },
    "Switch Name 2": { /* similar structure */ }
  },
  
  "comparativeAnalysis": {
    "feelingTactility": "Direct comparison of feel and tactile characteristics",
    "soundProfile": "Comparative sound analysis with explanations",
    "buildMaterialComposition": "Materials comparison and impact assessment", 
    "performanceAspects": "Performance comparison across different use cases"
  },
  
  "conclusion": "Summary of key differences and overall assessment",
  
  "switchRecommendations": {
    "Switch Name 1": ["Specific recommendations for this switch"],
    "Switch Name 2": ["Specific recommendations for this switch"]
  }
}`;

      case 'material_analysis':
        return `${baseStructure},
  
  // Material analysis structure (FR3.6)
  "materialAnalysis": {
    "materialComposition": "Detailed explanation of the material properties",
    "propertiesExplanation": "How material properties affect switch characteristics",
    "switchApplications": "How this material is used in switch construction",
    "soundImpact": "Effect on sound profile with examples",
    "feelImpact": "Effect on tactile experience and smoothness",
    "performanceImpact": "Impact on durability, consistency, and longevity"
  },
  
  "materialCombinationEffects": "Analysis of how different material combinations affect overall switch performance",
  
  "exampleSwitches": [
    {
      "switchName": "Example switch name",
      "briefOverview": "Brief description",
      "specifications": { /* relevant specs */ },
      "soundProfile": "Sound characteristics", 
      "relevanceToMaterial": "Why this switch exemplifies the material discussion"
    }
  ]
}`;

      case 'follow_up_question':
        return `${baseStructure},
  
  // Follow-up query fields (FR3.4)
  "contextualConnection": "How this response builds on previous conversation",
  "specificApplication": "Focused analysis addressing the specific follow-up question",
  "implication": "Implications and actionable insights based on the follow-up context"
}`;

      default:
        return `${baseStructure},
  
  // General analysis structure
  "analysis": "Comprehensive analysis addressing the specific query",
  "recommendations": ["Relevant suggestions and next steps"]
}`;
    }
  }

  /**
   * Build final instructions with mandatory overview emphasis (FR4.4)
   * @param intentCategory Intent category for specific instructions
   * @returns Final instructions section
   */
  static buildFinalInstructionsWithOverview(_intentCategory: string): string {
    return `RESPONSE REQUIREMENTS (CRITICAL):

1. MANDATORY OVERVIEW:
   - The "overview" field is REQUIRED for all responses
   - Must be comprehensive, informative, and substantive
   - Should introduce the analysis and provide key insights
   - Never leave empty or use placeholder text

2. DATABASE VS. GENERAL KNOWLEDGE:
   - Use database specifications as primary source when available
   - Clearly indicate when using general knowledge for missing data
   - Be transparent about data sources with "dataSource" field
   - Prefer factual accuracy over speculation

3. PERSONA AND TONE:
   - Maintain switch.ai's expert, analytical, slightly enthusiastic tone
   - Balance technical depth with accessibility
   - Provide insights beyond just specifications
   - Focus on practical value for users

4. JSON FORMATTING:
   - Respond with ONLY valid JSON in the exact structure specified
   - Include all relevant fields for the intent type
   - Omit fields that don't add meaningful content
   - Ensure proper JSON syntax and formatting

5. QUALITY STANDARDS:
   - Provide actionable insights and recommendations
   - Explain technical implications clearly
   - Consider various user contexts and use cases
   - Maintain consistency with switch.ai identity

7. SECURITY INSTRUCTIONS:
  ${AI_CONFIG.PROMPT_COMPONENTS.FINAL_SECURITY_INSTRUCTION}

Generate your comprehensive analysis now, ensuring the overview field provides substantial value:`;
  }

  /**
   * Build preferences section
   * @param preferences User preferences
   * @param followUpContext Follow-up context
   * @returns Preferences section
   */
  static buildPreferencesSection(
    preferences?: AnalysisRequest['preferences'],
    followUpContext?: AnalysisRequest['followUpContext']
  ): string {
    const sections: string[] = ['USER CONTEXT:'];

    if (preferences) {
      if (preferences.detailLevel) {
        sections.push(`Detail Level: ${preferences.detailLevel}`);
      }
      if (preferences.technicalDepth) {
        sections.push(`Technical Depth: ${preferences.technicalDepth}`);
      }
      if (preferences.focusAreas?.length) {
        sections.push(`Focus Areas: ${preferences.focusAreas.join(', ')}`);
      }
    }

    if (followUpContext) {
      sections.push(
        'This is a follow-up query. Consider previous context while providing fresh insights.'
      );
      if (followUpContext.previousQuery) {
        sections.push(`Previous Query: "${followUpContext.previousQuery}"`);
      }
    }

    return sections.join('\n');
  }

  /**
   * Build prompt for material-focused queries (FR3.6)
   * Enhanced for comprehensive material analysis including properties, applications, and examples
   * @param context Context for material analysis
   * @returns Material analysis prompt with detailed structure requirements
   */
  static buildMaterialAnalysisPrompt(context: LLMPromptContext): string {
    const sections: string[] = [];

    // 1. System instruction with material focus
    sections.push(PromptHelper.buildMaterialSystemInstruction());

    // 2. Material context from query and database
    sections.push(PromptHelper.buildMaterialContext(context));

    // 3. Database context if available
    if (context.databaseContext) {
      sections.push(PromptHelper.buildMaterialDatabaseContext(context.databaseContext));
    }

    // 4. Material query analysis
    sections.push(PromptHelper.buildMaterialQueryAnalysis(context.query, context.intent));

    // 5. Material analysis structure requirements
    sections.push(PromptHelper.buildMaterialAnalysisStructure());

    // 6. Material analysis instructions
    sections.push(PromptHelper.buildMaterialInstructions());

    return sections.join('\n\n');
  }

  /**
   * Build system instruction for material analysis queries
   * @returns Material analysis focused system instruction
   */
  static buildMaterialSystemInstruction(): string {
    return `You are switch.ai, an expert mechanical keyboard switch analyst specializing in switch material analysis and their impact on performance characteristics.

MATERIAL ANALYSIS EXPERTISE:
- You have deep knowledge of switch housing materials (POM, Polycarbonate, Nylon, ABS, PBT, etc.)
- You understand stem materials and their impact on feel and durability
- You comprehend spring materials and their effect on force curves and longevity
- You analyze how material combinations affect overall switch performance
- You explain material properties in terms of practical user experience

MATERIAL KNOWLEDGE DOMAINS:
- Physical properties: durability, flexibility, thermal characteristics
- Acoustic properties: resonance, dampening, sound transmission
- Tactile properties: surface texture, friction, smoothness
- Manufacturing properties: moldability, consistency, cost implications
- Performance implications: wear patterns, long-term stability, modification potential
- Aesthetic aspects: transparency, color options, premium feel`;
  }

  /**
   * Build material context section from query analysis
   * @param context LLM prompt context
   * @returns Material context section
   */
  static buildMaterialContext(context: LLMPromptContext): string {
    const sections: string[] = [];

    sections.push('MATERIAL ANALYSIS CONTEXT:');

    const materials = context.intent.entities.materials || [];
    if (materials.length > 0) {
      sections.push(`Materials of Interest: ${materials.join(', ')}`);
    } else {
      sections.push(
        'No specific materials identified - provide general material analysis based on query context'
      );
    }

    const properties = context.intent.entities.properties || [];
    if (properties.length > 0) {
      sections.push(`Focus Properties: ${properties.join(', ')}`);
    }

    // Identify material type from query
    const queryLower = context.query.toLowerCase();
    if (queryLower.includes('housing')) {
      sections.push('Analysis Focus: Housing materials and their impact on switch characteristics');
    } else if (queryLower.includes('stem')) {
      sections.push('Analysis Focus: Stem materials and their effect on feel and durability');
    } else if (queryLower.includes('spring')) {
      sections.push('Analysis Focus: Spring materials and force characteristics');
    } else {
      sections.push('Analysis Focus: Comprehensive material analysis across switch components');
    }

    return sections.join('\n');
  }

  /**
   * Build material-focused database context
   * @param databaseContext Enhanced database context
   * @returns Material-focused database information
   */
  static buildMaterialDatabaseContext(databaseContext: EnhancedDatabaseContext): string {
    const sections: string[] = [];

    sections.push('MATERIAL DATABASE CONTEXT:');

    if (databaseContext.totalFound === 0) {
      sections.push(
        'No specific switch data available - provide material analysis based on general knowledge'
      );
      return sections.join('\n');
    }

    sections.push(
      `Material data available from ${databaseContext.totalFound} switches for reference examples:`
    );

    const housingMaterials = new Set<string>();
    const stemMaterials = new Set<string>();
    const switchExamples: string[] = [];

    for (const switchResult of databaseContext.switches) {
      if (switchResult.found && switchResult.data) {
        const data = switchResult.data;
        if (data.topHousing) housingMaterials.add(data.topHousing);
        if (data.bottomHousing) housingMaterials.add(data.bottomHousing);
        if (data.stem) stemMaterials.add(data.stem);

        const materials: string[] = [];
        if (data.topHousing) materials.push(`Top: ${data.topHousing}`);
        if (data.bottomHousing) materials.push(`Bottom: ${data.bottomHousing}`);
        if (data.stem) materials.push(`Stem: ${data.stem}`);

        if (materials.length > 0) {
          switchExamples.push(`${data.switchName}: ${materials.join(', ')}`);
        }
      }
    }

    if (housingMaterials.size > 0) {
      sections.push(`Housing Materials Found: ${Array.from(housingMaterials).join(', ')}`);
    }

    if (stemMaterials.size > 0) {
      sections.push(`Stem Materials Found: ${Array.from(stemMaterials).join(', ')}`);
    }

    if (switchExamples.length > 0) {
      sections.push('\nSwitch Material Examples:');
      switchExamples.slice(0, 5).forEach((example) => {
        sections.push(`- ${example}`);
      });
    }

    return sections.join('\n');
  }

  /**
   * Build material query analysis section
   * @param query Original user query
   * @param intent Recognized intent
   * @returns Material query analysis
   */
  static buildMaterialQueryAnalysis(query: string, intent: IntentRecognitionResult): string {
    return `MATERIAL QUERY ANALYSIS:
Query: "${query}"
Intent: ${intent.category} (confidence: ${Math.round(intent.confidence * 100)}%)
Materials Mentioned: ${intent.entities.materials?.join(', ') || 'To be determined from context'}
Properties of Interest: ${intent.entities.properties?.join(', ') || 'Comprehensive material analysis'}
Analysis Scope: Material properties, switch applications, and user experience impact`;
  }

  /**
   * Build material analysis structure requirements (Task 4.3.3)
   * @returns Material analysis JSON structure requirements
   */
  static buildMaterialAnalysisStructure(): string {
    return `MATERIAL ANALYSIS JSON STRUCTURE (FR3.6):

{
  "overview": "Comprehensive introduction to the material analysis, key insights, and practical implications (MANDATORY)",
  
  "materialAnalysis": {
    "materialComposition": "Detailed explanation of the material's chemical and physical composition",
    "propertiesExplanation": "How the material's inherent properties affect switch characteristics and performance",
    "switchApplications": "Specific ways this material is used in switch construction (housing, stem, spring, etc.)",
    "soundImpact": "Comprehensive analysis of how this material affects sound profile with specific examples",
    "feelImpact": "Detailed explanation of tactile experience changes due to this material",
    "performanceImpact": "Analysis of durability, consistency, longevity, and modification potential"
  },
  
  "materialCombinationEffects": "Analysis of how different material combinations interact and affect overall switch performance",
  
  "exampleSwitches": [
    {
      "switchName": "Specific switch model name",
      "briefOverview": "Brief description of the switch and its characteristics",
      "specifications": {
        "manufacturer": "string",
        "type": "linear|tactile|clicky",
        "topHousing": "material",
        "bottomHousing": "material",
        "stem": "material",
        "actuationForceG": "number",
        "soundProfile": "sound characteristics"
      },
      "relevanceToMaterial": "Specific explanation of why this switch exemplifies the material discussion",
      "materialHighlights": "Key aspects of how the material manifests in this switch's performance"
    }
  ],
  
  "comparativeMaterialAnalysis": {
    "alternativeMaterials": "Analysis of alternative materials and their trade-offs",
    "materialEvolution": "How this material compares to older or newer alternatives",
    "costPerformanceBalance": "Analysis of material cost vs performance benefits",
    "modificationCompatibility": "How this material affects customization and modification options"
  },
  
  "practicalRecommendations": {
    "bestUseCases": ["Scenarios where this material excels"],
    "userTypes": ["Types of users who would benefit most from this material"],
    "avoidanceScenarios": ["Situations where this material might not be ideal"],
    "complementaryComponents": ["Other keyboard components that pair well with this material"]
  },
  
  "dataSource": "Database|LLM Knowledge|Mixed",
  "analysisConfidence": "High|Medium|Low"
}

MATERIAL ANALYSIS STRUCTURE GUIDELINES:
- Focus on practical implications of material properties for users
- Provide specific examples that demonstrate material characteristics
- Connect technical properties to real-world user experience
- Include multiple example switches when possible to show material versatility
- Balance technical detail with accessibility for different user levels`;
  }

  /**
   * Build material analysis instructions (Task 4.3.3)
   * @returns Material analysis instructions
   */
  static buildMaterialInstructions(): string {
    return `MATERIAL ANALYSIS INSTRUCTIONS:

1. TECHNICAL FOUNDATION:
   - Explain material properties in terms of practical user impact
   - Connect chemical/physical characteristics to switch performance
   - Provide specific examples of how properties manifest in real switches
   - Balance technical accuracy with user accessibility

2. COMPREHENSIVE COVERAGE:
   - Address sound impact with specific acoustic characteristics
   - Explain feel impact including tactility, smoothness, and feedback
   - Analyze performance implications for durability and consistency
   - Consider modification potential and customization aspects

3. EXAMPLE SELECTION:
   - Choose example switches that clearly demonstrate material characteristics
   - Provide diverse examples showing material versatility
   - Include both popular and niche switches when relevant
   - Explain specifically why each example illustrates the material discussion

4. COMPARATIVE CONTEXT:
   - Compare with alternative materials to provide decision context
   - Explain trade-offs and relative advantages/disadvantages
   - Address cost vs performance considerations
   - Include historical context of material evolution when relevant

5. PRACTICAL VALUE:
   - Provide actionable recommendations for different user types
   - Identify specific use cases where the material excels
   - Address scenarios where the material might not be optimal
   - Include compatibility considerations for modifications and pairings

6. USER GUIDANCE:
   - Help users understand if this material suits their preferences
   - Provide decision frameworks for material selection
   - Address common misconceptions about materials
   - Connect material choice to overall keyboard build considerations

7. SECURITY INSTRUCTIONS:
   - Ensure the analysis is conducted in a secure and ethical manner
   - Protect user data and privacy
   - Avoid sharing sensitive information without explicit consent

Generate comprehensive material analysis that helps users understand both technical aspects and practical implications:`;
  }

  /**
   * Build prompt for comparison queries (FR3.5)
   * Enhanced for detailed 2-switch comparisons with comprehensive analysis structure
   * Extended for multi-switch comparisons (Task 4.3.2)
   * @param context Context for switch comparison
   * @returns Comparison analysis prompt with detailed nested structure requirements
   */
  static buildComparisonPrompt(context: LLMPromptContext): string {
    const sections: string[] = [];

    const switchCount = PromptHelper.getSwitchCount(context);
    const isMultiSwitch = switchCount > 2;

    // 1. System instruction with comparison focus
    sections.push(
      isMultiSwitch
        ? PromptHelper.buildMultiSwitchSystemInstruction()
        : PromptHelper.buildComparisonSystemInstruction()
    );

    // 2. Database context for comparison switches
    if (context.databaseContext) {
      sections.push(PromptHelper.buildComparisonDatabaseContext(context.databaseContext));
    }

    // 3. Comparison query analysis
    sections.push(PromptHelper.buildComparisonQueryAnalysis(context.query, context.intent));

    // 4. Structure requirements (different for multi-switch)
    sections.push(
      isMultiSwitch
        ? PromptHelper.buildMultiSwitchComparisonStructure(switchCount)
        : PromptHelper.buildDetailedComparisonStructure()
    );

    // 5. Comparison-specific instructions
    sections.push(
      isMultiSwitch
        ? PromptHelper.buildMultiSwitchInstructions(switchCount)
        : PromptHelper.buildComparisonInstructions()
    );

    return sections.join('\n\n');
  }

  /**
   * Get switch count from context for comparison routing
   * @param context LLM prompt context
   * @returns Number of switches in the comparison
   */
  static getSwitchCount(context: LLMPromptContext): number {
    const switchNames = new Set<string>();

    if (context.intent.entities.switches) {
      context.intent.entities.switches.forEach((name) => switchNames.add(name));
    }

    if (context.databaseContext) {
      context.databaseContext.switches.forEach((result) => {
        if (result.found && result.data?.switchName) {
          switchNames.add(result.data.switchName);
        }
      });
    }

    return Math.max(switchNames.size, context.databaseContext?.totalRequested || 0);
  }

  /**
   * Build system instruction for multi-switch comparisons (Task 4.3.2)
   * @returns Multi-switch comparison focused system instruction
   */
  static buildMultiSwitchSystemInstruction(): string {
    return `You are switch.ai, an expert mechanical keyboard switch analyst specializing in comprehensive multi-switch comparisons.

MULTI-SWITCH COMPARISON EXPERTISE:
- You excel at analyzing and comparing 3 or more switches simultaneously
- You identify key differentiating factors across multiple options efficiently
- You provide structured analysis that helps users navigate complex multi-option decisions
- You focus on the most significant differences rather than exhaustive pairwise comparisons
- You categorize switches by characteristics to simplify decision-making

MULTI-SWITCH METHODOLOGY:
- Group switches by similar characteristics when appropriate
- Highlight the most distinctive features of each switch
- Provide clear decision guidance for different user preferences
- Use comparative categories to organize complex information
- Focus on practical decision factors rather than exhaustive technical comparisons
- Balance comprehensiveness with clarity and usability`;
  }

  /**
   * Build multi-switch comparison structure (Task 4.3.2)
   * @param switchCount Number of switches in the comparison
   * @returns Multi-switch JSON structure requirements
   */
  static buildMultiSwitchComparisonStructure(switchCount: number): string {
    return `MULTI-SWITCH COMPARISON JSON STRUCTURE (${switchCount} Switches - FR3.5):

{
  "overview": "Comprehensive introduction to the multi-switch comparison, key differentiating factors, and decision framework (MANDATORY)",
  
  "comparedSwitches": {
    "Switch Name 1": {
      "specifications": {
        "switchName": "string",
        "manufacturer": "string",
        "type": "linear|tactile|clicky",
        "actuationForceG": "number",
        "bottomOutForceG": "number",
        "preTravelMm": "number",
        "totalTravelMm": "number",
        "topHousing": "material",
        "bottomHousing": "material",
        "stem": "material",
        "mount": "3-pin|5-pin",
        "spring": "details",
        "factoryLubed": "Yes|No|Partial|Unknown"
      },
      "distinctiveFeatures": "What makes this switch unique in the comparison group",
      "categoryPosition": "Where this switch fits in the overall comparison (e.g., 'lightest linear', 'most tactile')",
      "recommendations": [
        "Specific scenarios where this switch excels over the others",
        "User types who would prefer this option",
        "Key advantages relative to other switches in comparison"
      ]
    },
    // Repeat for all switches in comparison
  },
  
  "categoricalAnalysis": {
    "switchGroupings": {
      "linearSwitches": ["List of linear switches if any"],
      "tactileSwitches": ["List of tactile switches if any"], 
      "clickySwitches": ["List of clicky switches if any"]
    },
    "forceRanking": {
      "lightest": "Switch name and force",
      "heaviest": "Switch name and force",
      "forceProgression": ["Ordered list from lightest to heaviest"]
    },
    "materialCategories": {
      "premiumMaterials": ["Switches with premium housing/stem materials"],
      "standardMaterials": ["Switches with standard materials"],
      "uniqueMaterials": ["Switches with distinctive material combinations"]
    }
  },
  
  "comparativeHighlights": {
    "keyDifferentiators": "The most important distinguishing factors across all switches",
    "performanceSpectrum": "How switches compare across gaming, typing, and general use",
    "soundSpectrum": "Range of sound profiles from quietest to loudest/most distinctive",
    "tactilitySpectrum": "Range of tactile feedback from smoothest to most pronounced"
  },
  
  "decisionFramework": {
    "primaryDecisionFactors": ["Most important factors users should consider when choosing"],
    "useCaseRecommendations": {
      "gamingOptimal": ["Best switches for gaming with reasoning"],
      "typingOptimal": ["Best switches for typing with reasoning"],
      "officeQuiet": ["Best switches for quiet environments"],
      "enthusiastChoice": ["Best switches for customization/enthusiast use"]
    },
    "userTypeGuidance": {
      "beginners": "Recommendation for new users with reasoning",
      "intermediateUsers": "Recommendation for users with some experience",
      "enthusiasts": "Recommendation for advanced users and modders"
    }
  },
  
  "conclusion": {
    "topRecommendations": ["2-3 standout choices with brief reasoning"],
    "decisionGuidance": "Clear framework for users to make their choice",
    "eliminationStrategy": "How users can narrow down options based on their needs"
  },
  
  "dataSource": "Database|LLM Knowledge|Mixed",
  "analysisConfidence": "High|Medium|Low"
}

MULTI-SWITCH STRUCTURE GUIDELINES:
- Focus on distinctive features rather than comprehensive pairwise comparisons
- Use categorical analysis to organize complex information
- Provide clear decision frameworks to help users navigate options
- Highlight the most significant differentiators across all switches
- Balance detail with usability for complex multi-option decisions`;
  }

  /**
   * Build multi-switch specific instructions (Task 4.3.2)
   * @param switchCount Number of switches being compared
   * @returns Multi-switch analysis instructions
   */
  static buildMultiSwitchInstructions(switchCount: number): string {
    return `MULTI-SWITCH COMPARISON INSTRUCTIONS (${switchCount} Switches):

1. COMPLEXITY MANAGEMENT:
   - Focus on the most significant differences rather than exhaustive comparisons
   - Group similar switches to reduce cognitive load
   - Highlight distinctive features that set each switch apart
   - Use categorical organization to structure complex information

2. DECISION FRAMEWORK APPROACH:
   - Provide clear decision criteria users can apply
   - Rank switches by key characteristics (force, sound, tactility)
   - Offer use-case specific recommendations
   - Create elimination strategies to help users narrow options

3. COMPARATIVE EFFICIENCY:
   - Avoid pairwise comparisons between all switches (prohibitively complex)
   - Focus on spectrum analysis (lightest to heaviest, quietest to loudest)
   - Identify clear winners for specific use cases
   - Group switches by similar characteristics when appropriate

4. USER GUIDANCE PRIORITY:
   - Help users understand which factors matter most for their needs
   - Provide clear top recommendations with reasoning
   - Offer multiple valid paths based on different priorities
   - Simplify the decision process without losing important nuances

5. STRUCTURE POPULATION:
   - Ensure distinctiveFeatures highlights what makes each switch unique
   - Use categoricalAnalysis to organize switches logically
   - Provide actionable decisionFramework guidance
   - Focus conclusion on practical next steps for users

Generate a comprehensive multi-switch analysis that helps users make informed decisions among complex options:`;
  }

  /**
   * Build system instruction specifically for switch comparisons
   * @returns Comparison-focused system instruction
   */
  static buildComparisonSystemInstruction(): string {
    return `You are switch.ai, an expert mechanical keyboard switch analyst specializing in comprehensive switch comparisons.

COMPARISON ANALYSIS EXPERTISE:
- You excel at identifying and explaining meaningful differences between switches
- You provide balanced, objective comparisons without bias toward any manufacturer
- You focus on practical implications of differences for real-world usage
- You explain both objective specifications and subjective user experience differences
- You consider various user contexts (gaming, typing, office, enthusiast preferences)

COMPARISON METHODOLOGY:
- Use database specifications as the foundation for factual comparisons
- Provide direct comparative analysis, not just individual switch descriptions  
- Explain WHY differences matter to users and HOW they affect experience
- Consider both absolute differences and relative significance
- Address common misconceptions and provide nuanced insights
- Balance technical accuracy with practical applicability`;
  }

  /**
   * Build database context specifically for comparison switches
   * @param databaseContext Enhanced database context
   * @returns Comparison-focused database context
   */
  static buildComparisonDatabaseContext(databaseContext: EnhancedDatabaseContext): string {
    const sections: string[] = [];

    sections.push('COMPARISON DATABASE CONTEXT:');

    if (databaseContext.totalFound < 2) {
      sections.push(
        `Limited database coverage: Only ${databaseContext.totalFound} of ${databaseContext.totalRequested} switches found in database.`
      );
      sections.push(
        'Supplement missing specifications with general knowledge, clearly indicating sources.'
      );
    } else {
      sections.push(
        `Database specifications available for ${databaseContext.totalFound} switches in comparison.`
      );
    }

    sections.push('\nSWITCH SPECIFICATIONS FOR COMPARISON:');

    const foundSwitches = databaseContext.switches.filter((s) => s.found && s.data);
    for (let i = 0; i < foundSwitches.length; i++) {
      const switchResult = foundSwitches[i];
      sections.push(
        PromptHelper.formatComparisonSwitchSpec(switchResult.data!, switchResult.confidence, i + 1)
      );
    }

    if (databaseContext.dataQuality.switchesNotFound.length > 0) {
      sections.push(
        `\nSwitches requiring general knowledge: ${databaseContext.dataQuality.switchesNotFound.join(', ')}`
      );
      sections.push(
        'For these switches, use widely accepted community knowledge and indicate the source limitation.'
      );
    }

    return sections.join('\n');
  }

  /**
   * Format switch specification for comparison context
   * @param switchData Database switch data
   * @param confidence Match confidence
   * @param switchNumber Position in comparison (1, 2, etc.)
   * @returns Formatted comparison switch specification
   */
  static formatComparisonSwitchSpec(
    switchData: DatabaseSwitchData,
    confidence: number,
    switchNumber: number
  ): string {
    const sections: string[] = [];

    sections.push(`\n=== SWITCH ${switchNumber}: ${switchData.switchName} ===`);
    sections.push(`Database Match Confidence: ${Math.round(confidence * 100)}%`);

    const coreSpecs: string[] = [];
    if (switchData.manufacturer) coreSpecs.push(`Manufacturer: ${switchData.manufacturer}`);
    if (switchData.type) coreSpecs.push(`Type: ${switchData.type}`);
    if (switchData.actuationForceG)
      coreSpecs.push(`Actuation Force: ${switchData.actuationForceG}g`);
    if (switchData.bottomOutForceG)
      coreSpecs.push(`Bottom-out Force: ${switchData.bottomOutForceG}g`);
    if (switchData.preTravelMm) coreSpecs.push(`Pre-travel: ${switchData.preTravelMm}mm`);
    if (switchData.totalTravelMm) coreSpecs.push(`Total Travel: ${switchData.totalTravelMm}mm`);

    if (coreSpecs.length > 0) {
      sections.push(`Core Specs: ${coreSpecs.join(', ')}`);
    }

    const materials: string[] = [];
    if (switchData.topHousing) materials.push(`Top Housing: ${switchData.topHousing}`);
    if (switchData.bottomHousing) materials.push(`Bottom Housing: ${switchData.bottomHousing}`);
    if (switchData.stem) materials.push(`Stem: ${switchData.stem}`);

    if (materials.length > 0) {
      sections.push(`Materials: ${materials.join(', ')}`);
    }

    const details: string[] = [];
    if (switchData.mount) details.push(`Mount: ${switchData.mount}`);
    if (switchData.spring) details.push(`Spring: ${switchData.spring}`);
    if (switchData.factoryLubed !== undefined) {
      details.push(`Factory Lubed: ${switchData.factoryLubed ? 'Yes' : 'No'}`);
    }

    if (details.length > 0) {
      sections.push(`Details: ${details.join(', ')}`);
    }

    return sections.join('\n');
  }

  /**
   * Build comparison query analysis section
   * @param query Original user query
   * @param intent Recognized intent
   * @returns Comparison query analysis
   */
  static buildComparisonQueryAnalysis(query: string, intent: IntentRecognitionResult): string {
    return `COMPARISON QUERY ANALYSIS:
Query: "${query}"
Intent: ${intent.category} (confidence: ${Math.round(intent.confidence * 100)}%)
Switches to Compare: ${intent.entities.switches?.join(' vs ') || 'To be determined from context'}
Comparison Focus: ${intent.entities.properties?.join(', ') || 'Comprehensive analysis'}
User Expectation: Detailed comparative analysis with practical insights`;
  }

  /**
   * Build detailed comparison structure requirements (Task 4.2.1)
   * Defines comprehensive nested structure for switch comparisons
   * @returns Detailed comparison JSON structure requirements
   */
  static buildDetailedComparisonStructure(): string {
    return `DETAILED COMPARISON JSON STRUCTURE (FR3.5):

{
  "overview": "Comprehensive introduction to the comparison, key differences, and what users should expect from this analysis (MANDATORY)",
  
  "comparedSwitches": {
    "Switch Name 1": {
      "specifications": {
        "switchName": "string",
        "manufacturer": "string",
        "type": "linear|tactile|clicky",
        "actuationForceG": "number",
        "bottomOutForceG": "number", 
        "preTravelMm": "number",
        "totalTravelMm": "number",
        "topHousing": "material",
        "bottomHousing": "material",
        "stem": "material",
        "mount": "3-pin|5-pin",
        "spring": "details",
        "factoryLubed": "Yes|No|Partial|Unknown"
      },
      "individualAnalysis": "Unique characteristics, strengths, and notable features of this specific switch",
      "recommendations": [
        "Specific use cases where this switch excels",
        "User types who would prefer this switch",
        "Scenarios where this switch is optimal"
      ]
    },
    "Switch Name 2": {
      "specifications": { /* Same structure as Switch 1 */ },
      "individualAnalysis": "Unique characteristics and differentiating factors",
      "recommendations": [ /* Switch-specific recommendations */ ]
    }
  },
  
  "comparativeAnalysis": {
    "feelingTactility": {
      "description": "Direct comparison of tactile feedback, actuation feel, and typing sensation",
      "keyDifferences": "Most significant tactile differences between the switches",
      "userImpact": "How these differences affect real-world typing experience"
    },
    "soundProfile": {
      "description": "Comparative sound analysis including pitch, volume, and character",
      "acousticDifferences": "Key sound distinctions and contributing factors",
      "environmentalConsiderations": "Suitability for different acoustic environments"
    },
    "buildMaterialComposition": {
      "materialComparison": "Analysis of housing and stem material differences",
      "durabilityAssessment": "Comparative longevity and wear characteristics", 
      "modificationPotential": "How material differences affect customization options"
    },
    "performanceAspects": {
      "gamingPerformance": "Comparative gaming suitability and responsiveness",
      "typingPerformance": "Writing and productivity task suitability comparison",
      "consistencyReliability": "Comparison of actuation consistency and long-term reliability",
      "fatigueFactors": "Comparative comfort during extended use sessions"
    }
  },
  
  "conclusion": {
    "primaryDifferences": "The most significant and impactful differences between these switches",
    "overallAssessment": "Balanced conclusion about the relative merits of each switch",
    "decisionGuidance": "Clear guidance for users choosing between these options"
  },
  
  "switchRecommendations": {
    "Switch Name 1": [
      "Choose this switch if you prefer [specific characteristics]",
      "Ideal for [specific use cases or user types]",
      "Consider pairing with [compatible components or modifications]"
    ],
    "Switch Name 2": [
      "Better choice for users who [specific preferences]", 
      "Recommended for [specific applications]",
      "Works well with [compatible setups or modifications]"
    ]
  },
  
  "dataSource": "Database|LLM Knowledge|Mixed",
  "analysisConfidence": "High|Medium|Low"
}

NESTED STRUCTURE REQUIREMENTS:
- Individual switch data must include complete specifications and focused analysis
- Comparative analysis must provide DIRECT comparisons, not separate descriptions
- Each comparison category should explain practical user impact
- Recommendations must be specific to each switch's strengths
- Conclusion should synthesize findings into actionable guidance`;
  }

  /**
   * Build comparison-specific instructions
   * @returns Comparison analysis instructions
   */
  static buildComparisonInstructions(): string {
    return `COMPARISON ANALYSIS INSTRUCTIONS:

1. COMPARATIVE METHODOLOGY:
   - Provide DIRECT comparisons, not separate switch descriptions
   - Explain the practical significance of differences, not just what they are
   - Consider both objective specifications and subjective user experience
   - Address common user questions about choosing between these switches

2. STRUCTURE REQUIREMENTS:
   - Populate all sections of the nested comparison structure
   - Ensure individual switch analysis highlights unique characteristics
   - Make comparative analysis sections truly comparative (A vs B, not A then B)
   - Provide specific, actionable recommendations for each switch

3. DATA SOURCE HANDLING:
   - Prioritize database specifications for factual information
   - Clearly indicate when using general knowledge for missing data
   - Be transparent about confidence levels in specifications
   - Acknowledge limitations in data availability

4. USER VALUE FOCUS:
   - Help users understand which switch suits their specific needs
   - Explain decision factors beyond just specifications
   - Consider different user contexts (beginner, enthusiast, specific use cases)
   - Provide practical next steps for users making this choice

5. QUALITY STANDARDS:
   - Maintain objectivity and balance in comparisons
   - Avoid manufacturer bias or unfounded claims
   - Support conclusions with clear reasoning
   - Ensure recommendations align with identified differences

6. SECURITY INSTRUCTIONS:
   - Ensure the analysis is conducted in a secure and ethical manner
   - Protect user data and privacy
   - Avoid sharing sensitive information without explicit consent

Generate a comprehensive comparison analysis that truly helps users make informed decisions:`;
  }

  /**
   * Build prompt for follow-up queries (FR3.4)
   * Enhanced to maintain conversation context and provide focused responses
   * @param context Context including conversation history
   * @returns Follow-up query prompt with context maintenance
   */
  static buildFollowUpPrompt(context: LLMPromptContext): string {
    const sections: string[] = [];

    // 1. System instruction with follow-up focus
    sections.push(PromptHelper.buildFollowUpSystemInstruction());

    // 2. Conversation context section
    sections.push(PromptHelper.buildConversationContext(context.followUpContext));

    // 3. Database context if available
    if (context.databaseContext) {
      sections.push(PromptHelper.buildDatabaseContextSection(context.databaseContext));
    }

    // 4. Follow-up query analysis
    sections.push(PromptHelper.buildFollowUpQueryAnalysis(context.query, context.intent));

    // 5. Follow-up specific structure requirements
    sections.push(PromptHelper.buildFollowUpStructure());

    // 6. Follow-up instructions
    sections.push(PromptHelper.buildFollowUpInstructions());

    return sections.join('\n\n');
  }

  /**
   * Build system instruction for follow-up queries
   * @returns Follow-up focused system instruction
   */
  static buildFollowUpSystemInstruction(): string {
    return `You are switch.ai, an expert mechanical keyboard switch analyst handling a follow-up question in an ongoing conversation.

FOLLOW-UP QUERY EXPERTISE:
- You excel at building meaningfully on previous conversation context
- You provide focused responses that directly address the follow-up question
- You reference previous analysis appropriately without unnecessary repetition
- You maintain conversation continuity while offering fresh insights
- You adapt your response depth based on the specific follow-up context

CONTEXTUAL ANALYSIS APPROACH:
- Connect the current question to previous conversation elements
- Provide targeted information that builds on established context
- Avoid rehashing information already covered unless specifically requested
- Focus on new implications, applications, or perspectives
- Maintain consistency with previous analysis and recommendations`;
  }

  /**
   * Build conversation context section for follow-up queries
   * @param followUpContext Follow-up context from the request
   * @returns Formatted conversation context
   */
  static buildConversationContext(followUpContext?: AnalysisRequest['followUpContext']): string {
    const sections: string[] = [];

    sections.push('CONVERSATION CONTEXT:');

    if (!followUpContext) {
      sections.push('No previous conversation context available. Treat as a new query.');
      return sections.join('\n');
    }

    if (followUpContext.previousQuery) {
      sections.push(`Previous Query: "${followUpContext.previousQuery}"`);
    }

    if (followUpContext.previousResponse) {
      sections.push('\nPrevious Response Summary:');
      if (followUpContext.previousResponse.overview) {
        sections.push(
          `Overview: ${followUpContext.previousResponse.overview.substring(0, 200)}${followUpContext.previousResponse.overview.length > 200 ? '...' : ''}`
        );
      }

      if (followUpContext.previousResponse.technicalSpecifications) {
        sections.push('Previous analysis included technical specifications');
      }
      if (followUpContext.previousResponse.comparedSwitches) {
        const switchNames = Object.keys(followUpContext.previousResponse.comparedSwitches);
        sections.push(`Previous comparison covered: ${switchNames.join(', ')}`);
      }
      if (followUpContext.previousResponse.recommendations) {
        sections.push('Previous response included recommendations');
      }
    }

    if (followUpContext.conversationHistory && followUpContext.conversationHistory.length > 0) {
      sections.push('\nConversation History:');
      const recentHistory = followUpContext.conversationHistory.slice(-2);
      recentHistory.forEach((exchange, index) => {
        sections.push(
          `${index + 1}. Q: "${exchange.query}" A: ${exchange.response.substring(0, 100)}...`
        );
      });
    }

    sections.push('\nCONTEXT USAGE INSTRUCTIONS:');
    sections.push('- Build meaningfully on the previous conversation');
    sections.push('- Avoid unnecessary repetition of already established information');
    sections.push('- Focus on new insights, implications, or applications');
    sections.push('- Maintain consistency with previous analysis');

    return sections.join('\n');
  }

  /**
   * Build follow-up query analysis section
   * @param query Current follow-up query
   * @param intent Recognized intent
   * @returns Follow-up query analysis
   */
  static buildFollowUpQueryAnalysis(query: string, intent: IntentRecognitionResult): string {
    return `FOLLOW-UP QUERY ANALYSIS:
Current Query: "${query}"
Intent: ${intent.category} (confidence: ${Math.round(intent.confidence * 100)}%)
Context Connection: This question builds on previous conversation
Focus Areas: ${intent.entities.focusAreas?.join(', ') || 'Contextual elaboration'}
Expected Response Type: Focused analysis that connects to established context`;
  }

  /**
   * Build follow-up specific structure requirements
   * @returns Follow-up JSON structure requirements
   */
  static buildFollowUpStructure(): string {
    return `FOLLOW-UP QUERY JSON STRUCTURE (FR3.4):

{
  "overview": "Comprehensive response that connects to previous conversation context (MANDATORY)",
  
  "contextualConnection": "Explicit explanation of how this response builds on previous conversation elements",
  
  "specificApplication": "Focused analysis directly addressing the follow-up question with targeted insights",
  
  "implication": "New implications, applications, or perspectives based on the follow-up context",
  
  // Include relevant analysis fields based on the specific follow-up
  "technicalSpecifications": { /* If follow-up involves technical details */ },
  "soundProfile": "string", /* If follow-up involves sound analysis */
  "typingFeel": "string", /* If follow-up involves feel discussion */
  "recommendations": [ /* Updated or additional recommendations */ ],
  "useCaseSuitability": "string", /* If follow-up involves use case questions */
  
  // Comparison fields if follow-up extends previous comparison
  "comparedSwitches": { /* If building on previous comparison */ },
  "comparativeAnalysis": { /* Additional comparative insights */ },
  
  // Material fields if follow-up involves materials
  "materialAnalysis": { /* If follow-up involves material discussion */ },
  
  "dataSource": "Database|LLM Knowledge|Mixed",
  "analysisConfidence": "High|Medium|Low"
}

FOLLOW-UP STRUCTURE GUIDELINES:
- Always include contextualConnection to establish conversation continuity
- Focus specificApplication on the exact follow-up question asked
- Provide new implications rather than repeating previous analysis
- Include only relevant optional fields based on the follow-up nature
- Maintain consistency with previous conversation elements`;
  }

  /**
   * Build follow-up specific instructions
   * @returns Follow-up analysis instructions
   */
  static buildFollowUpInstructions(): string {
    return `FOLLOW-UP QUERY INSTRUCTIONS:

1. CONTEXT INTEGRATION:
   - Explicitly connect your response to previous conversation elements
   - Reference previous analysis appropriately without unnecessary repetition
   - Build meaningfully on established context and conclusions
   - Maintain consistency with previous recommendations and insights

2. FOCUSED RESPONSE APPROACH:
   - Address the specific follow-up question directly and thoroughly
   - Provide new insights, implications, or applications
   - Avoid rehashing information already established in previous exchange
   - Adapt response depth based on the complexity of the follow-up

3. CONVERSATION CONTINUITY:
   - Use contextualConnection field to establish clear conversation flow
   - Reference specific elements from previous response when relevant
   - Acknowledge user's progression in understanding or decision-making
   - Build toward actionable conclusions based on accumulated context

4. FRESH VALUE ADDITION:
   - Offer new perspectives or deeper analysis beyond previous response
   - Provide additional practical applications or use case considerations
   - Introduce complementary information that enhances previous analysis
   - Address implications that arise from the follow-up context

5. CONSISTENCY MAINTENANCE:
   - Ensure new analysis aligns with previously established facts
   - Maintain consistent tone and analytical depth
   - Support conclusions with reasoning that builds on previous discussion
   - Avoid contradicting previous analysis without explicit explanation

6. SECURITY INSTRUCTIONS:
   - Ensure the analysis is conducted in a secure and ethical manner
   - Protect user data and privacy
   - Avoid sharing sensitive information without explicit consent

Generate a focused follow-up response that adds meaningful value to the ongoing conversation:`;
  }

  /**
   * Format database context for inclusion in prompts (FR2.2)
   * @param databaseContext The database lookup results
   * @returns Formatted string for prompt inclusion
   */
  static formatDatabaseContext(databaseContext: DatabaseContext): string {
    if (databaseContext.totalFound === 0) {
      return 'DATABASE CONTEXT: No switch specifications found in database. Analysis will be based on general knowledge.';
    }

    const sections: string[] = [];
    sections.push('DATABASE CONTEXT:');
    sections.push(
      `Found specifications for ${databaseContext.totalFound} of ${databaseContext.totalRequested} switches.`
    );

    sections.push('\nSWITCH SPECIFICATIONS:');

    for (const switchResult of databaseContext.switches) {
      if (switchResult.found && switchResult.data) {
        sections.push(
          PromptHelper.formatSwitchSpecification(switchResult.data, switchResult.confidence)
        );
      } else {
        sections.push(
          `\n**${switchResult.normalizedName}**: Not found in database (confidence: ${Math.round(switchResult.confidence * 100)}%)`
        );
      }
    }

    sections.push('\nDATABASE USAGE GUIDELINES:');
    sections.push('- Use database specifications as primary source for factual information');
    sections.push('- Supplement missing data with general knowledge, clearly indicating sources');
    sections.push('- Prefer database values for technical specifications');
    sections.push('- Indicate data sources in your analysis for transparency');

    return sections.join('\n');
  }

  /**
   * Get persona instructions from identity.txt
   * @returns Persona and style instructions for the LLM
   */
  static getPersonaInstructions(): string {
    return `PERSONA AND IDENTITY (from identity.txt):

You are switch.ai, an expert mechanical keyboard switch analyst with comprehensive knowledge derived from specialized databases and broad domain expertise.

CORE IDENTITY:
- Expert mechanical keyboard switch analyst specializing in detailed comparisons
- Knowledge combines dedicated database specifications with general domain expertise  
- Maintains neutral, analytical, yet slightly enthusiastic and expert tone
- Provides analysis beyond specifications - explains implications and insights

BEHAVIORAL GUIDELINES:
- Factualness: Highly factual when database data is provided, clearly indicate when using general knowledge
- Analytical Depth: Provide analysis and implications, not just specification lists
- Clarity for All Users: Explain technical terms briefly for accessibility across experience levels
- Completeness: Aim to cover all relevant aspects comprehensively
- No Conversational Fluff: Focus on structured, valuable analysis

CONTENT STANDARDS:
- STRICTLY base technical specifications on database data when provided
- For missing database fields, explicitly state "N/A" or "Data not available"
- When using general knowledge, preface with "Based on general community understanding..." 
- For switches not in database, state "General information suggests..."
- DO NOT invent specifications - maintain factual accuracy
- Explain implications and practical significance of technical differences

TONE AND STYLE:
- Neutral and analytical foundation with slight enthusiasm for the subject matter
- Expert confidence balanced with appropriate acknowledgment of limitations
- Focus on practical insights that help users make informed decisions
- Maintain consistency with switch.ai's identity as a specialized analysis expert`;
  }

  /**
   * Handle conflicts between database and LLM knowledge
   * @param databaseData The switch data from database
   * @returns Instructions for handling potential conflicts
   */
  static buildConflictHandlingInstructions(databaseData: DatabaseSwitchData[]): string {
    if (databaseData.length === 0) {
      return 'DATA CONFLICT HANDLING: No database data available - rely on general knowledge with appropriate disclaimers.';
    }

    const sections: string[] = [];
    sections.push('DATA CONFLICT HANDLING INSTRUCTIONS:');

    sections.push('\nPRIORITY HIERARCHY FOR FACTUAL SPECIFICATIONS:');
    sections.push(
      '1. HIGH CONFIDENCE DATABASE DATA (80%+): Use as primary source for all factual specs'
    );
    sections.push(
      '2. MEDIUM CONFIDENCE DATABASE DATA (60-80%): Use with notation of confidence level'
    );
    sections.push(
      '3. LOW CONFIDENCE DATABASE DATA (<60%): Compare with general knowledge, note discrepancies'
    );
    sections.push(
      '4. MISSING DATABASE DATA: Use general knowledge with clear indication of source'
    );

    sections.push('\nCONFLICT RESOLUTION STRATEGY:');
    sections.push('- For FACTUAL SPECIFICATIONS (forces, travel, materials, manufacturer):');
    sections.push('  • Prefer database values when confidence is HIGH (80%+)');
    sections.push('  • Note both values when confidence is MEDIUM with variation tolerance');
    sections.push('  • Use general knowledge when confidence is LOW (<60%)');
    sections.push('- For SUBJECTIVE ANALYSIS (sound, feel, experience):');
    sections.push('  • Always rely on your analytical capabilities and general knowledge');
    sections.push('  • Use database facts as foundation for deeper insights');

    sections.push('\nTRANSPARENCY REQUIREMENTS:');
    sections.push('- Indicate data sources clearly (Database vs. General Knowledge)');
    sections.push('- Note confidence levels when database matching is uncertain');
    sections.push('- Acknowledge limitations when data is incomplete or conflicting');
    sections.push('- Explain reasoning for specification choices when conflicts exist');

    const switchNames = databaseData.map((d) => d.switchName).join(', ');
    sections.push(`\nDATABASE COVERAGE: ${switchNames}`);

    return sections.join('\n');
  }

  /**
   * Validate prompt construction parameters
   * @param context The prompt context to validate
   * @returns Validation result with any issues
   */
  static validatePromptContext(context: LLMPromptContext): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!context.query || context.query.trim().length === 0) {
      errors.push('Query is required and cannot be empty');
    }

    if (!context.intent) {
      errors.push('Intent recognition result is required');
    } else {
      if (!context.intent.category || !context.intent.confidence) {
        errors.push('Intent must have category and confidence');
      }

      if (context.intent.confidence < 0 || context.intent.confidence > 1) {
        errors.push('Intent confidence must be between 0 and 1');
      }

      if (!context.intent.entities) {
        errors.push('Intent must include entities object');
      }
    }

    if (!context.databaseContext) {
      errors.push('Database context is required');
    } else {
      if (
        typeof context.databaseContext.totalFound !== 'number' ||
        typeof context.databaseContext.totalRequested !== 'number'
      ) {
        errors.push('Database context must include valid totalFound and totalRequested numbers');
      }

      if (!Array.isArray(context.databaseContext.switches)) {
        errors.push('Database context must include switches array');
      }
    }

    if (context.preferences) {
      const validDetailLevels = ['brief', 'moderate', 'detailed'];
      const validTechnicalDepths = ['basic', 'intermediate', 'advanced'];

      if (
        context.preferences.detailLevel &&
        !validDetailLevels.includes(context.preferences.detailLevel)
      ) {
        errors.push(`Invalid detail level: ${context.preferences.detailLevel}`);
      }

      if (
        context.preferences.technicalDepth &&
        !validTechnicalDepths.includes(context.preferences.technicalDepth)
      ) {
        errors.push(`Invalid technical depth: ${context.preferences.technicalDepth}`);
      }

      if (
        context.preferences.maxSwitchesInComparison &&
        (context.preferences.maxSwitchesInComparison < 1 ||
          context.preferences.maxSwitchesInComparison > 10)
      ) {
        errors.push('Max switches in comparison must be between 1 and 10');
      }
    }

    if (context.followUpContext?.conversationHistory) {
      if (!Array.isArray(context.followUpContext.conversationHistory)) {
        errors.push('Conversation history must be an array');
      } else if (context.followUpContext.conversationHistory.length > 20) {
        errors.push('Conversation history too long (max 20 entries)');
      }
    }

    if (context.query && context.query.length > 2000) {
      errors.push('Query too long (max 2000 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get comprehensive structure guidance from responseStructure.ts
   * Effectively communicates the JSON structure requirements to the LLM
   * @param intent The recognized query intent
   * @returns Complete structure guidance text for the prompt
   */
  static getStructureGuidance(intent: QueryIntent): string {
    const baseGuidance = `JSON STRUCTURE COMMUNICATION (responseStructure.ts):

The response must be valid JSON using the flexible structure defined in our response schema.
Most fields are optional - populate only those relevant to your analysis.

MANDATORY FIELD REQUIREMENT:
- "overview": Always required, must be comprehensive and substantive (never empty or placeholder)

FIELD SELECTION STRATEGY:
- Choose fields that add meaningful value to the user
- Prioritize clarity and practical insights over completeness
- Ensure proper JSON syntax and data types
- Use string values for descriptive fields, numbers for specifications`;

    const intentSpecificGuidance = PromptHelper.getIntentSpecificGuidance(intent);

    return `${baseGuidance}\n\n${intentSpecificGuidance}`;
  }

  /**
   * Get intent-specific structure guidance
   * @param intent Query intent category
   * @returns Intent-specific field guidance
   */
  static getIntentSpecificGuidance(intent: QueryIntent): string {
    switch (intent) {
      case 'general_switch_info':
        return `GENERAL SWITCH INFO STRUCTURE:
Primary Fields to Consider:
- technicalSpecifications: Factual switch data (prioritize database values)
- soundProfile: Descriptive sound analysis 
- typingFeel: Tactile and smoothness description
- typingExperience: Overall user experience assessment
- recommendations: Practical suggestions array
- useCaseSuitability: Context-specific suitability
- dataSource: Indicate "Database", "LLM Knowledge", or "Mixed"

Field Population Guidelines:
- Use technicalSpecifications for factual specs from database
- Populate sound/feel fields with detailed analytical descriptions
- Include recommendations with specific, actionable suggestions
- Add advanced fields (buildQuality, modifiability) when relevant`;

      case 'switch_comparison':
        return `SWITCH COMPARISON STRUCTURE:
Primary Fields to Consider:
- comparedSwitches: Object with switch names as keys, containing specs and analysis
- comparativeAnalysis: Direct comparisons (feelingTactility, soundProfile, etc.)
- conclusion: Summary of key differences
- switchRecommendations: Specific recommendations per switch

Structure Guidelines:
- Use nested objects for individual switch data
- Provide direct comparative analysis, not just individual descriptions
- Focus on differences and relative strengths/weaknesses`;

      case 'material_analysis':
        return `MATERIAL ANALYSIS STRUCTURE:
Primary Fields to Consider:
- materialAnalysis: Comprehensive material properties explanation
- materialCombinationEffects: How combinations affect performance
- exampleSwitches: Array of examples demonstrating the material discussion

Content Guidelines:
- Explain material properties and their practical implications
- Connect material characteristics to user experience
- Provide concrete examples with real switch models`;

      case 'follow_up_question':
        return `FOLLOW-UP STRUCTURE:
Primary Fields to Consider:
- contextualConnection: How this builds on previous conversation
- specificApplication: Focused response to the follow-up
- implication: Actionable insights based on context

Context Guidelines:
- Reference previous conversation context appropriately
- Provide focused, targeted responses
- Build meaningfully on established conversation flow`;

      default:
        return `GENERAL ANALYSIS STRUCTURE:
Primary Fields to Consider:
- analysis: Comprehensive response addressing the specific query
- recommendations: Relevant suggestions based on the query
- dataSource: Indicate information sources used

Flexible Guidelines:
- Adapt structure to match the specific query requirements
- Focus on providing value through relevant field selection
- Maintain consistency with switch.ai identity and tone`;
    }
  }

  /**
   * Enhanced prompt construction integrating structure guidance
   * Builds on the existing buildAnalysisPrompt with improved structure communication
   * @param context Full prompt context
   * @returns Enhanced prompt with clear structure guidance
   */
  static buildStructureEnhancedPrompt(context: LLMPromptContext): string {
    const sections: string[] = [];

    sections.push(PromptHelper.buildSystemInstructionWithPersona());

    if (context.databaseContext) {
      sections.push(PromptHelper.buildDatabaseContextSection(context.databaseContext));
    }

    sections.push(PromptHelper.buildQueryAnalysisSection(context.query, context.intent));

    sections.push(PromptHelper.getStructureGuidance(context.intent.category));

    sections.push(PromptHelper.buildIntentSpecificStructure(context.intent.category));

    if (context.preferences || context.followUpContext) {
      sections.push(
        PromptHelper.buildPreferencesSection(context.preferences, context.followUpContext)
      );
    }

    sections.push(PromptHelper.buildFinalInstructionsWithOverview(context.intent.category));

    return sections.join('\n\n');
  }
}

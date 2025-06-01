import { AI_CONFIG } from '../config/ai.config.js';
import { ChatMessage } from '../types/chat.js';
import { MaterialContextService, type SwitchMaterialData } from './materialContext.js';

interface SwitchContextItem {
  name: string;
  manufacturer: string;
  type: string | null;
  spring: string | null;
  actuationForce: number | null;
  description_text?: string;
  similarity?: number;
}

export interface EnhancedSwitchData {
  name: string;
  dataBlock: string;
  materialData?: SwitchMaterialData;
}

export class PromptBuilder {
  private static materialContextService = new MaterialContextService();

  /**
   * Build the final prompt string by concatenating structured components
   * Combines role definition, task description, context, and formatting instructions
   *
   * @param conversationHistory - Previous conversation messages for context
   * @param retrievedContexts - Relevant switch information from database
   * @param userQuery - Current user query
   * @returns Complete prompt string for LLM generation
   */
  static buildPrompt(
    conversationHistory: Pick<ChatMessage, 'role' | 'content'>[],
    retrievedContexts: SwitchContextItem[],
    userQuery: string
  ): string {
    const P = AI_CONFIG.PROMPT_COMPONENTS;
    let prompt = '';

    prompt += `${P.ROLE_DEFINITION}\n\n`;
    prompt += `${P.CORE_TASK_DESCRIPTION}\n\n`;

    prompt += `${P.CONTEXT_SECTION_HEADER_HISTORY}\n`;
    if (conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-AI_CONFIG.CHAT_HISTORY_MAX_TURNS * 2);
      for (const msg of recentHistory) {
        const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';
        prompt += `${roleLabel}: ${msg.content}\n`;
      }
    } else {
      prompt += 'No previous conversation history for this session.\n';
    }
    prompt += '\n';

    prompt += `${P.CONTEXT_SECTION_HEADER_KB}\n`;
    if (retrievedContexts.length > 0) {
      retrievedContexts.forEach((ctx, index) => {
        prompt += `Context Item ${index + 1}:\n`;
        prompt += `  Name: ${ctx.name}\n`;
        prompt += `  Manufacturer: ${ctx.manufacturer}\n`;
        prompt += `  Type: ${ctx.type || 'N/A'}\n`;
        if (ctx.description_text) {
          prompt += `  Description: ${ctx.description_text}\n`;
        } else {
          prompt += `  Spring: ${ctx.spring || 'N/A'}\n`;
          prompt += `  Actuation Force: ${ctx.actuationForce ? ctx.actuationForce + 'g' : 'N/A'}\n`;
        }
        if (ctx.similarity) {
          prompt += `  (Relevance Score: ${ctx.similarity.toFixed(2)})\n`;
        }
        prompt += '\n';
      });
    } else {
      prompt += `${P.CONTEXT_NO_KB_INFO_FOUND_MESSAGE}\n`;
      prompt += `${P.CONTEXT_NO_KB_INSTRUCTION_TO_LLM}\n`;
    }
    prompt += '\n';

    prompt += `${P.USER_QUERY_HEADER}\n${userQuery}\n\n`;
    prompt += `### OUTPUT_INSTRUCTIONS (Follow these for your response):\n${P.OUTPUT_FORMAT_INSTRUCTIONS}\n\n`;

    prompt += `### RESPONSE_QUALITIES_AND_CONSTRAINTS (Adhere to these):\n`;
    P.OUTPUT_QUALITIES_LIST.forEach((constraint) => {
      prompt += `- ${constraint}\n`;
    });
    prompt += '\n';

    prompt += `### BEHAVIORAL_GUIDELINE (Overall approach):\n${P.BEHAVIORAL_GUIDELINE_FACTUALNESS}\n\n`;

    prompt += "Assistant's Response:\n";

    return prompt;
  }

  /**
   * Enhanced comparison prompt with comprehensive material context injection
   * Builds structured comparison prompts with enthusiast terminology and technical depth
   *
   * @param conversationHistory - Previous conversation context
   * @param enhancedSwitchData - Switch data with material information
   * @param missingDataInstructions - Instructions for handling missing data
   * @param userQuery - Original user query
   * @param originalSwitchNames - List of switch names being compared
   * @param detectedUseCase - Optional detected use case for context
   * @returns Complete enhanced comparison prompt
   */
  static buildEnhancedComparisonPrompt(
    conversationHistory: Pick<ChatMessage, 'role' | 'content'>[],
    enhancedSwitchData: EnhancedSwitchData[],
    missingDataInstructions: string,
    userQuery: string,
    originalSwitchNames: string[],
    detectedUseCase?: string
  ): string {
    let prompt = '';

    prompt += `CORE IDENTITY\n`;
    prompt += `You are switch.ai, an expert mechanical keyboard switch analyst. Your knowledge is derived from a dedicated database of switch specifications, enhanced by rich material property context, and supplemented by broad general knowledge of the mechanical keyboard domain.\n\n`;

    prompt += `PRIMARY_TASK: GENERATE_SWITCH_COMPARISON\n`;
    prompt += `Given switch names by the user and their corresponding data from our database (and/or supplemental general knowledge for missing data), generate a comprehensive, structured comparison enhanced with material context and enthusiast terminology.\n\n`;

    prompt += `INPUT_CONTEXT:\n`;
    prompt += `USER_QUERY: ${userQuery}\n`;
    prompt += `IDENTIFIED_SWITCHES: [${originalSwitchNames.join(', ')}]\n\n`;

    const materialContexts = enhancedSwitchData
      .filter((switch_) => switch_.materialData)
      .map((switch_) => ({ name: switch_.name, materials: switch_.materialData! }));

    if (materialContexts.length > 0) {
      const materialContext =
        this.materialContextService.generateComparisonContext(materialContexts);
      prompt += `${materialContext}\n\n`;
    }

    if (detectedUseCase) {
      const useCaseContext = this.materialContextService.generateUseCaseContext(
        detectedUseCase as any
      );
      prompt += `${useCaseContext}\n\n`;
    }

    prompt += `SWITCH_DATA_BLOCKS:\n`;
    enhancedSwitchData.forEach((switchData, index) => {
      prompt += `Switch ${index + 1}:\n${switchData.dataBlock}\n`;
    });
    prompt += '\n';

    if (missingDataInstructions) {
      prompt += `${missingDataInstructions}\n\n`;
    }

    prompt += `CONVERSATION_HISTORY: `;
    if (conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-AI_CONFIG.CHAT_HISTORY_MAX_TURNS * 2);
      for (const msg of recentHistory) {
        const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';
        prompt += `${roleLabel}: ${msg.content}; `;
      }
      prompt += '\n\n';
    } else {
      prompt += 'No previous conversation history.\n\n';
    }

    prompt += `OUTPUT_STRUCTURE_AND_FORMATTING_RULES:\n`;
    prompt += `Overall Format: Markdown.\n`;
    prompt += `Sections (Strict Order - Use H2 for these, e.g., ## Overview):\n\n`;

    prompt += `## Section Instructions (Generate ALL sections in this exact order):\n\n`;

    prompt += `### ## Overview Section:\n`;
    prompt += `- Provide a brief introduction to each switch using enthusiast terminology\n`;
    prompt += `- Describe their general positioning in the market (budget, premium, enthusiast, etc.)\n`;
    prompt += `- Highlight notable material characteristics and sound signatures\n`;
    prompt += `- Use descriptive language (thocky, clacky, buttery smooth) where appropriate\n`;
    prompt += `- Keep this section concise (2-4 sentences per switch)\n`;
    prompt += `- Use bold formatting for switch names throughout\n\n`;

    prompt += `### ## Technical Specifications Section:\n`;
    prompt += `- If comparing 2-3 switches: Use a Markdown table format\n`;
    prompt += `- If comparing 4+ switches: Use bulleted lists under each switch name\n`;
    prompt += `- REQUIRED table columns/fields (in this order): Switch Name, Manufacturer, Type, Actuation Force, Bottom-Out Force, Pre-Travel, Total Travel, Top Housing, Bottom Housing, Stem, Spring, Mount, Factory Lubed\n`;
    prompt += `- For missing data: explicitly state "N/A" or "Data not available for [Switch Name]"\n`;
    prompt += `- Include units (e.g., "45g", "2.0mm") where applicable\n`;
    prompt += `- USE database specifications as foundational context, enhanced by material property insights\n\n`;

    prompt += `### ## In-Depth Analysis Section (Use H3 subsections):\n`;
    prompt += `Generate the following H3 subsections in order:\n\n`;

    prompt += `#### ### Housing Materials:\n`;
    prompt += `- LEVERAGE provided material context to explain housing characteristics\n`;
    prompt += `- Use enthusiast terminology (thocky, clacky, buttery smooth, etc.) naturally\n`;
    prompt += `- Explain how material choices create specific sound signatures\n`;
    prompt += `- Discuss impact on feel and typing experience using descriptive language\n`;
    prompt += `- Compare material combinations and their implications\n`;
    prompt += `- Integrate material property insights from the context provided\n\n`;

    prompt += `#### ### Force & Weighting:\n`;
    prompt += `- Analyze actuation and bottom-out forces with typing experience implications\n`;
    prompt += `- Use material context insights about spring characteristics\n`;
    prompt += `- Explain implications for different use cases and user preferences\n`;
    prompt += `- Discuss typing fatigue considerations using provided weight category insights\n`;
    prompt += `- Compare force curves and typing dynamics with enthusiast perspective\n\n`;

    prompt += `#### ### Travel & Actuation:\n`;
    prompt += `- Discuss pre-travel and total travel characteristics\n`;
    prompt += `- Explain effect on typing speed, responsiveness, and gaming performance\n`;
    prompt += `- Analyze actuation point positioning and feedback timing\n`;
    prompt += `- Consider impact on different typing styles and preferences\n\n`;

    prompt += `#### ### Sound Profile:\n`;
    prompt += `- Use material context to explain expected sound characteristics\n`;
    prompt += `- Employ enthusiast terminology and material property insights\n`;
    prompt += `- Analyze factors contributing to sound (materials, design, lubrication)\n`;
    prompt += `- Compare frequency ranges and volume characteristics\n`;
    prompt += `- Consider environmental suitability based on sound profiles\n\n`;

    prompt += `#### ### Feel & Tactility/Linearity:\n`;
    prompt += `- Describe typing experience using rich descriptive language\n`;
    prompt += `- INTEGRATE stem material characteristics from context\n`;
    prompt += `- Use material insights to explain smoothness, consistency, feedback\n`;
    prompt += `- Compare overall typing sensation with enthusiast terminology\n`;
    prompt += `- Leverage provided material context for detailed feel analysis\n\n`;

    prompt += `#### ### Use Case Suitability (Optional - include if user query implies specific use):\n`;
    prompt += `- Use material and use case context to make informed recommendations\n`;
    prompt += `- Consider environmental requirements and user preferences\n`;
    prompt += `- Provide practical guidance based on material characteristics\n`;
    prompt += `- Integrate use case insights from provided context\n\n`;

    prompt += `### ## Typing Experience Summary Section:\n`;
    prompt += `- Provide enthusiast-level summary using material context insights\n`;
    prompt += `- Focus on holistic experience with rich descriptive language\n`;
    prompt += `- Use material property understanding to explain overall character\n`;
    prompt += `- Keep brief but descriptive (2-3 sentences per switch)\n\n`;

    prompt += `### ## Conclusion Section:\n`;
    prompt += `- Summarize key differences with enthusiast-level insights\n`;
    prompt += `- Highlight material-based differentiators and sound signatures\n`;
    prompt += `- Provide balanced assessment using descriptive terminology\n`;
    prompt += `- End with practical guidance informed by material characteristics\n\n`;

    prompt += `Content Constraints:\n`;
    prompt += `USE database technical specifications from SWITCH_DATA_BLOCKS as foundational context, enhanced by material property insights when available.\n`;
    prompt += `INTEGRATE material context naturally to provide rich, descriptive analysis beyond raw specifications.\n`;
    prompt += `For missing database information, gracefully supplement with general knowledge while clearly indicating sources: "Based on general community understanding..." or "Typically, switches with these characteristics...".\n`;
    prompt += `For switches not in database, state: "For [Switch Name not in DB], general information suggests..." and provide comprehensive analysis using general knowledge.\n`;
    prompt += `PRIORITIZE descriptive, enthusiast-level language over bland technical descriptions.\n`;
    prompt += `LEVERAGE material property context to explain why certain combinations produce specific sound/feel characteristics.\n`;
    prompt += `DO NOT limit analysis to only database specifications - use them as starting points for deeper insights.\n\n`;

    prompt += `BEHAVIORAL_GUIDELINES:\n`;
    prompt += `Enhanced Factualness: Combine database accuracy with material science insights and community knowledge for comprehensive analysis.\n`;
    prompt += `Rich Descriptive Language: Replace generic terms with vivid descriptions and enthusiast terminology throughout.\n`;
    prompt += `Material-Informed Analysis: Explain how material choices create specific sound signatures and typing experiences.\n`;
    prompt += `Context-Driven Insights: Use material context to provide deeper understanding of switch characteristics.\n`;
    prompt += `Enthusiast Expertise: Write as a knowledgeable community member familiar with keyboard terminology and preferences.\n`;
    prompt += `Balanced Approach: Blend technical accuracy with descriptive richness and practical insights.\n`;
    prompt += `No Conversational Fluff: Directly generate the structured comparison with enhanced analytical depth.\n\n`;

    prompt += `Markdown Usage Requirements:\n`;
    prompt += `Use bold for switch names (e.g., **Gateron Oil King**).\n`;
    prompt += `Use bold for key technical terms upon first significant mention.\n`;
    prompt += `Use enthusiast terminology naturally throughout (thocky, clacky, buttery smooth, scratchy, etc.).\n`;
    prompt += `Use bullet points for lists within analytical sections.\n`;
    prompt += `Use proper H2 (##) for main sections and H3 (###) for subsections.\n\n`;

    prompt += `Generate the enhanced structured comparison now:\n`;

    return prompt;
  }

  /**
   * Legacy comparison prompt builder (maintained for backward compatibility)
   */
  static buildComparisonPrompt(
    conversationHistory: Pick<ChatMessage, 'role' | 'content'>[],
    switchDataBlocks: string[],
    missingDataInstructions: string,
    userQuery: string,
    originalSwitchNames: string[]
  ): string {
    const enhancedSwitchData: EnhancedSwitchData[] = switchDataBlocks.map((dataBlock, index) => ({
      name: originalSwitchNames[index] || `Switch ${index + 1}`,
      dataBlock
    }));

    return this.buildEnhancedComparisonPrompt(
      conversationHistory,
      enhancedSwitchData,
      missingDataInstructions,
      userQuery,
      originalSwitchNames
    );
  }

  /**
   * Extract material data from switch data block for context injection
   */
  static extractMaterialDataFromBlock(switchDataBlock: string): SwitchMaterialData | null {
    try {
      const lines = switchDataBlock.split('\n');
      let topHousing: string | null = null;
      let bottomHousing: string | null = null;
      let stem: string | null = null;
      let spring: string | null = null;
      let actuationForce: number | null = null;
      let bottomForce: number | null = null;

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('TOP_HOUSING:')) {
          topHousing = trimmed.replace('TOP_HOUSING:', '').trim();
        } else if (trimmed.startsWith('BOTTOM_HOUSING:')) {
          bottomHousing = trimmed.replace('BOTTOM_HOUSING:', '').trim();
        } else if (trimmed.startsWith('STEM:')) {
          stem = trimmed.replace('STEM:', '').trim();
        } else if (trimmed.startsWith('SPRING:')) {
          spring = trimmed.replace('SPRING:', '').trim();
        } else if (trimmed.startsWith('ACTUATION_FORCE_G:')) {
          const forceStr = trimmed.replace('ACTUATION_FORCE_G:', '').trim();
          actuationForce = forceStr && forceStr !== 'N/A' ? parseFloat(forceStr) : null;
        } else if (trimmed.startsWith('BOTTOM_OUT_FORCE_G:')) {
          const forceStr = trimmed.replace('BOTTOM_OUT_FORCE_G:', '').trim();
          bottomForce = forceStr && forceStr !== 'N/A' ? parseFloat(forceStr) : null;
        }
      }

      return {
        topHousing,
        bottomHousing,
        stem,
        spring,
        actuationForce,
        bottomForce
      };
    } catch (error) {
      console.error('Error extracting material data from switch block:', error);
      return null;
    }
  }

  /**
   * Build enhanced switch data with material context
   */
  static buildEnhancedSwitchData(
    switchNames: string[],
    switchDataBlocks: string[]
  ): EnhancedSwitchData[] {
    return switchNames.map((name, index) => {
      const dataBlock = switchDataBlocks[index] || '';
      const materialData = this.extractMaterialDataFromBlock(dataBlock);

      return {
        name,
        dataBlock,
        materialData: materialData || undefined
      };
    });
  }

  /**
   * Build characteristics analysis prompt for educational content about switch characteristics
   * Used for queries asking about general characteristics rather than specific switches
   *
   * @param conversationHistory - Previous conversation context
   * @param userQuery - Original user query
   * @param candidateSwitches - Example switches to illustrate characteristics
   * @param processingNote - Additional processing context
   * @returns Educational characteristics analysis prompt
   */
  static buildCharacteristicsAnalysisPrompt(
    conversationHistory: Pick<ChatMessage, 'role' | 'content'>[],
    userQuery: string,
    candidateSwitches: string[],
    processingNote: string
  ): string {
    let prompt = '';

    prompt += `CORE IDENTITY\n`;
    prompt += `You are switch.ai, an expert mechanical keyboard switch analyst specializing in explaining switch characteristics and helping users understand different types of switch properties.\n\n`;

    prompt += `PRIMARY_TASK: CHARACTERISTICS_ANALYSIS\n`;
    prompt += `The user wants to understand and compare different mechanical switch characteristics. Your job is to explain these characteristics in detail, focusing on:\n`;
    prompt += `- What each characteristic means in mechanical switch terms\n`;
    prompt += `- How these characteristics affect typing/gaming experience\n`;
    prompt += `- The mechanisms and materials that create these characteristics\n`;
    prompt += `- Sound profiles associated with each characteristic\n`;
    prompt += `- Use cases and preferences for each characteristic\n\n`;

    prompt += `INPUT_CONTEXT:\n`;
    prompt += `USER_QUERY: ${userQuery}\n`;
    prompt += `PROCESSING_NOTE: ${processingNote}\n`;
    if (candidateSwitches.length > 0) {
      prompt += `REPRESENTATIVE_EXAMPLES: [${candidateSwitches.join(', ')}] (use these as examples to illustrate points, but focus on characteristics)\n`;
    }
    prompt += `\n`;

    prompt += `CONVERSATION_HISTORY: `;
    if (conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-AI_CONFIG.CHAT_HISTORY_MAX_TURNS * 2);
      for (const msg of recentHistory) {
        const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';
        prompt += `${roleLabel}: ${msg.content}; `;
      }
      prompt += '\n\n';
    } else {
      prompt += 'No previous conversation history.\n\n';
    }

    prompt += `OUTPUT_STRUCTURE_AND_FORMATTING_RULES:\n`;
    prompt += `Overall Format: Markdown.\n`;
    prompt += `Focus: Educational explanation of characteristics, NOT detailed switch comparisons.\n\n`;

    prompt += `## Required Sections (Generate ALL sections in this exact order):\n\n`;

    prompt += `### ## Overview of Characteristics\n`;
    prompt += `- Provide a brief introduction to each characteristic being compared\n`;
    prompt += `- Explain what each characteristic means in mechanical keyboard terms\n`;
    prompt += `- Mention the general appeal and use cases for each characteristic\n\n`;

    prompt += `### ## Technical Mechanisms\n`;
    prompt += `- Explain HOW each characteristic is achieved mechanically\n`;
    prompt += `- Discuss switch types (linear, tactile, clicky) and their mechanisms\n`;
    prompt += `- Explain the role of springs, stems, housing materials, and other components\n`;
    prompt += `- Use technical terminology appropriately but keep it accessible\n\n`;

    prompt += `### ## Sound and Feel Profiles\n`;
    prompt += `- Describe the sound characteristics (thocky, clacky, crisp, muted, etc.)\n`;
    prompt += `- Explain the tactile feel and feedback differences\n`;
    prompt += `- Discuss how materials and construction affect sound and feel\n`;
    prompt += `- Use enthusiast terminology where appropriate\n\n`;

    prompt += `### ## Typing Experience and Use Cases\n`;
    prompt += `- Explain how each characteristic affects typing experience\n`;
    prompt += `- Discuss gaming vs typing preferences\n`;
    prompt += `- Mention fatigue considerations and speed implications\n`;
    prompt += `- Cover workplace/noise considerations\n\n`;

    if (candidateSwitches.length > 0) {
      prompt += `### ## Representative Examples\n`;
      prompt += `- Briefly mention some switches that exemplify each characteristic\n`;
      prompt += `- Use the provided examples: ${candidateSwitches.join(', ')}\n`;
      prompt += `- Keep this section brief - focus on how they illustrate the characteristics\n`;
      prompt += `- DO NOT do detailed switch-by-switch comparisons\n\n`;
    }

    prompt += `### ## Making Your Choice\n`;
    prompt += `- Provide guidance on how to choose between these characteristics\n`;
    prompt += `- Mention factors to consider (use case, environment, personal preference)\n`;
    prompt += `- Suggest ways to test or experience these characteristics\n\n`;

    prompt += `BEHAVIORAL_GUIDELINES:\n`;
    prompt += `- Focus on EDUCATING about characteristics, not comparing specific switches\n`;
    prompt += `- Use enthusiast terminology appropriately (thocky, clacky, buttery, scratchy, etc.)\n`;
    prompt += `- Keep explanations accessible but technically informed\n`;
    prompt += `- If mentioning specific switches, do so briefly as examples to illustrate characteristics\n`;
    prompt += `- Provide practical guidance for users trying to understand their preferences\n`;
    prompt += `- Use engaging, educational tone rather than dry technical writing\n\n`;

    prompt += "Assistant's Characteristics Analysis:\n";

    return prompt;
  }
}

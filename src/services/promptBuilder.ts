import { AI_CONFIG } from '../config/ai.config.js';
import { ChatMessage } from '../types/chat.js';
import { DatabaseSanitizer } from '../utils/databaseSanitizer.js';
import { PIIScrubber, PIIUtils } from '../utils/pii-scrubber.js';

interface SwitchContextItem {
  name: string;
  manufacturer: string;
  type: string | null;
  spring: string | null;
  actuationForce: number | null;
  description_text?: string;
  similarity?: number;
}

export class PromptBuilder {
  /**
   * Build the final prompt string by concatenating structured components:
   * 1) Role Definition
   * 2) Core Task Description
   * 3) Conversation History (Context) - with PII scrubbing
   * 4) Retrieved Knowledge Base Information (Context)
   * 5) Current User Query - with PII scrubbing
   * 6) Output Format Instructions
   * 7) Output Qualities and Constraints
   * 8) Behavioral Guideline (Factualness)
   */
  static buildPrompt(
    conversationHistory: Pick<ChatMessage, 'role' | 'content'>[],
    retrievedContexts: SwitchContextItem[],
    userQuery: string
  ): string {
    const P = AI_CONFIG.PROMPT_COMPONENTS;
    let prompt = '';

    // ### ROLE:
    prompt += `${P.ROLE_DEFINITION}\n\n`;

    // ### CORE_TASK:
    prompt += `${P.CORE_TASK_DESCRIPTION}\n\n`;

    // ### CONTEXT: Conversation History - with PII scrubbing
    prompt += `${P.CONTEXT_SECTION_HEADER_HISTORY}\n`;
    if (conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-AI_CONFIG.CHAT_HISTORY_MAX_TURNS * 2);

      const scrubbedHistory = PIIScrubber.scrubConversationHistory(recentHistory, true);

      for (const msg of scrubbedHistory) {
        const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';
        if (msg.role === 'user') {
          prompt += `${roleLabel}: <user_query>${msg.content}</user_query>\n`;
        } else {
          prompt += `${roleLabel}: ${msg.content}\n`;
        }
      }
    } else {
      prompt += 'No previous conversation history for this session.\n';
    }
    prompt += '\n';

    // ### CONTEXT: Relevant Information from Knowledge Base
    prompt += `${P.CONTEXT_SECTION_HEADER_KB}\n`;
    if (retrievedContexts.length > 0) {
      const { sanitizedContexts, overallSanitizationLog } =
        DatabaseSanitizer.sanitizeSwitchContextArray(retrievedContexts);

      if (overallSanitizationLog.length > 0) {
        DatabaseSanitizer.logSanitization('PROMPT_BUILDER_CONTEXTS', overallSanitizationLog);
      }

      sanitizedContexts.forEach((ctx, index) => {
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

    // ### USER_QUERY: - with PII scrubbing
    const scrubbedUserQuery = PIIUtils.scrubUserQuery(userQuery);
    prompt += `${P.USER_QUERY_HEADER}\n<user_query>${scrubbedUserQuery}</user_query>\n\n`;

    // ### OUTPUT_FORMAT_INSTRUCTIONS:
    prompt += `### OUTPUT_INSTRUCTIONS (Follow these for your response):\n${P.OUTPUT_FORMAT_INSTRUCTIONS}\n\n`;

    // ### OUTPUT_QUALITIES_AND_CONSTRAINTS:
    prompt += `### RESPONSE_QUALITIES_AND_CONSTRAINTS (Adhere to these):\n`;
    P.OUTPUT_QUALITIES_LIST.forEach((constraint) => {
      prompt += `- ${constraint}\n`;
    });
    prompt += '\n';

    // ### BEHAVIORAL_GUIDELINE_FACTUALNESS:
    prompt += `### BEHAVIORAL_GUIDELINE (Overall approach):\n${P.BEHAVIORAL_GUIDELINE_FACTUALNESS}\n\n`;

    // ### KNOWLEDGE SCOPING: "Foundation, Not a Fortress" Principle
    prompt += `### KNOWLEDGE_SCOPING_INSTRUCTION (Foundation, Not a Fortress):\n`;
    prompt += `When answering, use the provided database context as your primary source of truth. If the context is insufficient, you may use your general knowledge to fill in gaps, but you **must** state when you are doing so. For example, you could say, 'Based on the database, the switch has X characteristic. While not in the database, my general knowledge suggests that switches with these materials often have Y sound profile.'\n\n`;

    // ### FINAL_SECURITY_INSTRUCTION: Critical security directive
    prompt += `### SECURITY_DIRECTIVE (CRITICAL - NON-NEGOTIABLE):\n${P.FINAL_SECURITY_INSTRUCTION}\n\n`;

    prompt += "Assistant's Response:\n";

    return prompt;
  }

  /**
   * Build specialized comparison prompt using embedding-based data retrieval
   * Follows the structure from identity.txt but integrates with ComprehensiveSwitchData
   * Updated to generate structured JSON output with comparisonTable, summary, and recommendations
   */
  static buildComparisonPrompt(
    conversationHistory: Pick<ChatMessage, 'role' | 'content'>[],
    switchDataBlocks: string[],
    missingDataInstructions: string,
    userQuery: string,
    originalSwitchNames: string[]
  ): string {
    let prompt = '';

    // ### CORE IDENTITY (from identity.txt)
    prompt += `CORE IDENTITY\n`;
    prompt += `You are switch.ai, an expert mechanical keyboard switch analyst. Your knowledge is derived from a dedicated database of switch specifications and supplemented by broad general knowledge of the mechanical keyboard domain.\n\n`;

    // ### PRIMARY TASK
    prompt += `PRIMARY_TASK: GENERATE_STRUCTURED_SWITCH_COMPARISON\n`;
    prompt += `Given switch names by the user and their corresponding data from our database (and/or supplemental general knowledge for missing data), generate a comprehensive, structured comparison in JSON format.\n\n`;

    // ### INPUT CONTEXT
    prompt += `INPUT_CONTEXT:\n`;
    const scrubbedUserQuery = PIIUtils.scrubUserQuery(userQuery);
    prompt += `USER_QUERY: <user_query>${scrubbedUserQuery}</user_query>\n`;
    prompt += `IDENTIFIED_SWITCHES: [${originalSwitchNames.join(', ')}]\n\n`;

    // ### SWITCH DATA BLOCKS (from embedding-based retrieval) - Sanitize before including
    prompt += `SWITCH_DATA_BLOCKS:\n`;
    switchDataBlocks.forEach((dataBlock, index) => {
      const sanitizationResult = DatabaseSanitizer.sanitizeString(dataBlock);
      const piiScrubbedContent = PIIUtils.scrubDatabaseContent(sanitizationResult.sanitizedContent);

      if (sanitizationResult.wasModified) {
        DatabaseSanitizer.logSanitization('COMPARISON_PROMPT_DATA_BLOCKS', [sanitizationResult]);
      }
      prompt += `Switch ${index + 1}:\n${piiScrubbedContent}\n`;
    });
    prompt += '\n';

    // ### Missing data instructions (if any)
    if (missingDataInstructions) {
      prompt += `${missingDataInstructions}\n\n`;
    }

    // ### CONVERSATION HISTORY - with PII scrubbing
    prompt += `CONVERSATION_HISTORY: `;
    if (conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-AI_CONFIG.CHAT_HISTORY_MAX_TURNS * 2);

      const scrubbedHistory = PIIScrubber.scrubConversationHistory(recentHistory, true);

      for (const msg of scrubbedHistory) {
        const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';
        if (msg.role === 'user') {
          prompt += `${roleLabel}: <user_query>${msg.content}</user_query>; `;
        } else {
          prompt += `${roleLabel}: ${msg.content}; `;
        }
      }
      prompt += '\n\n';
    } else {
      prompt += 'No previous conversation history.\n\n';
    }

    // ### STRUCTURED JSON OUTPUT FORMAT
    prompt += `CRITICAL: You MUST respond with a valid JSON object in the following structure:\n\n`;

    prompt += `{\n`;
    prompt += `  "comparisonTable": {\n`;
    prompt += `    "headers": ["Switch Name", "Manufacturer", "Type", "Actuation Force", "Bottom-Out Force", "Pre-Travel", "Total Travel", "Top Housing", "Bottom Housing", "Stem", "Spring", "Mount"],\n`;
    prompt += `    "rows": [\n`;
    prompt += `      {\n`;
    prompt += `        "Switch Name": "Switch Name Here",\n`;
    prompt += `        "Manufacturer": "Manufacturer Here",\n`;
    prompt += `        "Type": "Linear/Tactile/Clicky or N/A",\n`;
    prompt += `        "Actuation Force": "45g or N/A",\n`;
    prompt += `        "Bottom-Out Force": "62g or N/A",\n`;
    prompt += `        "Pre-Travel": "2.0mm or N/A",\n`;
    prompt += `        "Total Travel": "4.0mm or N/A",\n`;
    prompt += `        "Top Housing": "Material or N/A",\n`;
    prompt += `        "Bottom Housing": "Material or N/A",\n`;
    prompt += `        "Stem": "Material or N/A",\n`;
    prompt += `        "Spring": "Type or N/A",\n`;
    prompt += `        "Mount": "3-pin/5-pin or N/A"\n`;
    prompt += `      }\n`;
    prompt += `      // ... additional switch objects for each switch being compared\n`;
    prompt += `    ]\n`;
    prompt += `  },\n`;
    prompt += `  "summary": "A comprehensive summary of the comparison covering key differences, strengths, and characteristics of each switch. Should be 3-5 paragraphs covering: 1) Overview of switches being compared, 2) Key technical differences, 3) Sound and feel characteristics, 4) Overall assessment and positioning",\n`;
    prompt += `  "recommendations": [\n`;
    prompt += `    {\n`;
    prompt += `      "text": "Specific recommendation for a particular use case or user type",\n`;
    prompt += `      "reasoning": "Detailed explanation of why this recommendation makes sense based on the switch characteristics"\n`;
    prompt += `    },\n`;
    prompt += `    {\n`;
    prompt += `      "text": "Another recommendation for different use case or preference",\n`;
    prompt += `      "reasoning": "Explanation for this recommendation"\n`;
    prompt += `    }\n`;
    prompt += `    // Include 2-4 recommendations total\n`;
    prompt += `  ]\n`;
    prompt += `}\n\n`;

    // ### DETAILED CONTENT INSTRUCTIONS
    prompt += `CONTENT GENERATION GUIDELINES:\n\n`;

    // ### COMPARISON TABLE INSTRUCTIONS
    prompt += `## Comparison Table Instructions:\n`;
    prompt += `- Include one row object for each switch being compared\n`;
    prompt += `- Use the exact header names specified in the JSON structure\n`;
    prompt += `- For missing data: use "N/A" or "Data not available"\n`;
    prompt += `- Include units where applicable (e.g., "45g", "2.0mm")\n`;
    prompt += `- Base ALL specifications strictly on SWITCH_DATA_BLOCKS provided\n`;
    prompt += `- Do not invent or guess technical specifications\n\n`;

    // ### SUMMARY INSTRUCTIONS
    prompt += `## Summary Instructions:\n`;
    prompt += `- Provide a comprehensive 3-5 paragraph analysis covering:\n`;
    prompt += `  1. Overview: Brief introduction to each switch and market positioning\n`;
    prompt += `  2. Technical Differences: Key spec differences and their implications\n`;
    prompt += `  3. Sound & Feel: Expected sound profile and typing experience for each\n`;
    prompt += `  4. Use Case Analysis: Suitability for different applications (gaming, typing, office)\n`;
    prompt += `  5. Overall Assessment: Balanced conclusion highlighting unique strengths\n`;
    prompt += `- Be analytical and technical while remaining accessible\n`;
    prompt += `- Explain implications of differences, not just list specifications\n`;
    prompt += `- Maintain neutral tone without heavily favoring any switch\n\n`;

    // ### RECOMMENDATIONS INSTRUCTIONS
    prompt += `## Recommendations Instructions:\n`;
    prompt += `- Provide 2-4 practical recommendations\n`;
    prompt += `- Each recommendation should target different use cases or user preferences:\n`;
    prompt += `  * Gaming vs typing vs office work\n`;
    prompt += `  * Sound sensitivity (quiet environments vs personal preference)\n`;
    prompt += `  * Force preference (light touch vs heavy)\n`;
    prompt += `  * Experience level (beginner vs enthusiast)\n`;
    prompt += `- Each reasoning should be specific and reference actual switch characteristics\n`;
    prompt += `- Make recommendations actionable and practical\n`;
    prompt += `- Consider user's specific query context when applicable\n\n`;

    // ### DATA HANDLING INSTRUCTIONS
    prompt += `DATA HANDLING REQUIREMENTS:\n`;
    prompt += `- STRICTLY base technical specifications on SWITCH_DATA_BLOCKS when provided\n`;
    prompt += `- For analytical content (summary, recommendations), you MAY supplement with general knowledge using clear attribution:\n`;
    prompt += `  * "Based on general community understanding..."\n`;
    prompt += `  * "Typically, switches with these characteristics..."\n`;
    prompt += `  * "According to widely reported user experiences..."\n`;
    prompt += `- For switches not in database: "Not in our database - based on general information..."\n`;
    prompt += `- Always distinguish between database facts and general knowledge\n`;
    prompt += `- Use "N/A" for missing technical specifications - never guess\n\n`;

    // ### JSON FORMATTING REQUIREMENTS
    prompt += `JSON FORMATTING REQUIREMENTS:\n`;
    prompt += `- Output ONLY valid JSON - no additional text before or after\n`;
    prompt += `- Use proper JSON escaping for quotes and special characters\n`;
    prompt += `- Ensure all string values are properly quoted\n`;
    prompt += `- Do not include comments in the actual JSON output\n`;
    prompt += `- Validate that your JSON structure matches the specified format exactly\n\n`;

    // ### BEHAVIORAL GUIDELINES
    prompt += `BEHAVIORAL_GUIDELINES:\n`;
    prompt += `- Factualness: Highly factual for technical specs, clearly attributed general knowledge for analysis\n`;
    prompt += `- Analytical Depth: Provide analysis and implications, not just raw data\n`;
    prompt += `- Clarity: Explain technical terms briefly while maintaining expert accuracy\n`;
    prompt += `- Completeness: Include all required JSON fields with meaningful content\n`;
    prompt += `- Objectivity: Maintain neutral analysis without bias toward any switch\n\n`;

    // ### FINAL_SECURITY_INSTRUCTION: Critical security directive
    const P = AI_CONFIG.PROMPT_COMPONENTS;
    prompt += `### SECURITY_DIRECTIVE (CRITICAL - NON-NEGOTIABLE):\n${P.FINAL_SECURITY_INSTRUCTION}\n\n`;

    // Final instruction
    prompt += `Generate the structured JSON comparison now (JSON only, no additional text):\n`;

    return prompt;
  }
}

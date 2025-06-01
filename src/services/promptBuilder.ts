import { AI_CONFIG } from '../config/ai.config.js';
import { ChatMessage } from '../types/chat.js';

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
   * 3) Conversation History (Context)
   * 4) Retrieved Knowledge Base Information (Context)
   * 5) Current User Query
   * 6) Output Format Instructions
   * 7) Output Qualities and Constraints
   * 8) Behavioral Guideline (Factualness)
   */
  static buildPrompt(
    conversationHistory: Pick<ChatMessage, 'role' | 'content'>[],
    retrievedContexts: SwitchContextItem[],
    userQuery: string
  ): string {
    const P = AI_CONFIG.PROMPT_COMPONENTS; // Alias for brevity
    let prompt = '';

    // ### ROLE:
    prompt += `${P.ROLE_DEFINITION}\n\n`;

    // ### CORE_TASK:
    prompt += `${P.CORE_TASK_DESCRIPTION}\n\n`;

    // ### CONTEXT: Conversation History
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

    // ### CONTEXT: Relevant Information from Knowledge Base
    prompt += `${P.CONTEXT_SECTION_HEADER_KB}\n`;
    if (retrievedContexts.length > 0) {
      retrievedContexts.forEach((ctx, index) => {
        prompt += `Context Item ${index + 1}:\n`;
        prompt += `  Name: ${ctx.name}\n`;
        prompt += `  Manufacturer: ${ctx.manufacturer}\n`;
        prompt += `  Type: ${ctx.type || 'N/A'}\n`;
        // Include other relevant fields from SwitchContextItem as needed by the prompt strategy
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

    // ### USER_QUERY:
    prompt += `${P.USER_QUERY_HEADER}\n${userQuery}\n\n`;

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

    // Final cue for the LLM
    prompt += "Assistant's Response:\n";

    return prompt;
  }

  /**
   * Build specialized comparison prompt using embedding-based data retrieval
   * Follows the structure from identity.txt but integrates with ComprehensiveSwitchData
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
    prompt += `PRIMARY_TASK: GENERATE_SWITCH_COMPARISON\n`;
    prompt += `Given switch names by the user and their corresponding data from our database (and/or supplemental general knowledge for missing data), generate a comprehensive, structured comparison.\n\n`;

    // ### INPUT CONTEXT
    prompt += `INPUT_CONTEXT:\n`;
    prompt += `USER_QUERY: ${userQuery}\n`;
    prompt += `IDENTIFIED_SWITCHES: [${originalSwitchNames.join(', ')}]\n\n`;

    // ### SWITCH DATA BLOCKS (from embedding-based retrieval)
    prompt += `SWITCH_DATA_BLOCKS:\n`;
    switchDataBlocks.forEach((dataBlock, index) => {
      prompt += `Switch ${index + 1}:\n${dataBlock}\n`;
    });
    prompt += '\n';

    // ### Missing data instructions (if any)
    if (missingDataInstructions) {
      prompt += `${missingDataInstructions}\n\n`;
    }

    // ### CONVERSATION HISTORY
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

    // ### OUTPUT STRUCTURE AND FORMATTING RULES (from identity.txt)
    prompt += `OUTPUT_STRUCTURE_AND_FORMATTING_RULES:\n`;
    prompt += `Overall Format: Markdown.\n`;
    prompt += `Sections (Strict Order - Use H2 for these, e.g., ## Overview):\n\n`;

    // ### DETAILED SECTION INSTRUCTIONS (per FR9)
    prompt += `## Section Instructions (Generate ALL sections in this exact order):\n\n`;

    prompt += `### ## Overview Section:\n`;
    prompt += `- Provide a brief introduction to each switch being compared\n`;
    prompt += `- Describe their general positioning in the market (budget, premium, enthusiast, etc.)\n`;
    prompt += `- Highlight notable characteristics that set each switch apart\n`;
    prompt += `- Keep this section concise (2-4 sentences per switch)\n`;
    prompt += `- Use bold formatting for switch names throughout\n\n`;

    prompt += `### ## Technical Specifications Section:\n`;
    prompt += `- If comparing 2-3 switches: Use a Markdown table format\n`;
    prompt += `- If comparing 4+ switches: Use bulleted lists under each switch name\n`;
    prompt += `- REQUIRED table columns/fields (in this order): Switch Name, Manufacturer, Type, Actuation Force, Bottom-Out Force, Pre-Travel, Total Travel, Top Housing, Bottom Housing, Stem, Spring, Mount\n`;
    prompt += `- For missing data: explicitly state "N/A" or "Data not available for [Switch Name]"\n`;
    prompt += `- Include units (e.g., "45g", "2.0mm") where applicable\n`;
    prompt += `- Base ALL specifications strictly on SWITCH_DATA_BLOCKS provided\n\n`;

    prompt += `### ## In-Depth Analysis Section (Use H3 subsections):\n`;
    prompt += `Generate the following H3 subsections in order:\n\n`;

    prompt += `#### ### Housing Materials:\n`;
    prompt += `- Analyze top and bottom housing materials for each switch\n`;
    prompt += `- Explain impact on sound profile (dampening, resonance, pitch)\n`;
    prompt += `- Discuss impact on feel (scratch, smoothness, tactile feedback)\n`;
    prompt += `- Compare material combinations between switches\n`;
    prompt += `- Use technical terms but explain briefly for beginners\n\n`;

    prompt += `#### ### Force & Weighting:\n`;
    prompt += `- Analyze actuation and bottom-out forces for each switch\n`;
    prompt += `- Explain implications for typing experience (light touch vs heavy)\n`;
    prompt += `- Discuss potential for typing fatigue during extended use\n`;
    prompt += `- Compare force curves and typing dynamics between switches\n`;
    prompt += `- Consider suitability for different hand strengths and preferences\n\n`;

    prompt += `#### ### Travel & Actuation:\n`;
    prompt += `- Discuss pre-travel and total travel distances\n`;
    prompt += `- Explain effect on perceived typing speed and responsiveness\n`;
    prompt += `- Analyze actuation point positioning and feedback timing\n`;
    prompt += `- Compare how travel distances affect typing rhythm\n`;
    prompt += `- Consider impact on gaming vs typing performance\n\n`;

    prompt += `#### ### Sound Profile:\n`;
    prompt += `- Describe expected sound characteristics (clacky, thocky, poppy, muted, etc.)\n`;
    prompt += `- Be analytical about factors contributing to sound (materials, design, lubrication)\n`;
    prompt += `- Compare volume levels and frequency ranges between switches\n`;
    prompt += `- Consider suitability for different environments (office, home, quiet spaces)\n`;
    prompt += `- If database info is sparse, use general knowledge with proper attribution\n\n`;

    prompt += `#### ### Feel & Tactility/Linearity:\n`;
    prompt += `- Describe the detailed typing experience for each switch\n`;
    prompt += `- For tactile switches: analyze bump shape, position, and intensity\n`;
    prompt += `- For linear switches: discuss smoothness, consistency, and any variations\n`;
    prompt += `- For clicky switches: describe click mechanism and timing\n`;
    prompt += `- Compare overall typing sensation and feedback quality\n\n`;

    prompt += `#### ### Use Case Suitability (Optional - include if user query implies specific use):\n`;
    prompt += `- Discuss suitability for gaming, typing, programming, office work\n`;
    prompt += `- Consider environmental requirements (quiet, shared spaces)\n`;
    prompt += `- Analyze performance for different user preferences and hand types\n`;
    prompt += `- Provide practical recommendations based on intended use\n\n`;

    prompt += `### ## Typing Experience Summary Section:\n`;
    prompt += `- Provide a concise summary of the overall subjective typing experience for each switch\n`;
    prompt += `- Focus on the holistic feel rather than individual technical aspects\n`;
    prompt += `- Use descriptive language that helps users visualize the experience\n`;
    prompt += `- Keep this section brief but informative (2-3 sentences per switch)\n\n`;

    prompt += `### ## Conclusion Section:\n`;
    prompt += `- Summarize key differences and overall standing of each switch\n`;
    prompt += `- Highlight the most significant differentiators between switches\n`;
    prompt += `- If user query included specific use case, tailor recommendation accordingly\n`;
    prompt += `- Provide balanced assessment without heavily favoring any switch\n`;
    prompt += `- End with practical guidance for potential buyers\n\n`;

    // ### MARKDOWN USAGE
    prompt += `Markdown Usage Requirements:\n`;
    prompt += `Use bold for switch names (e.g., **Gateron Oil King**).\n`;
    prompt += `Use bold for key technical terms upon first significant mention.\n`;
    prompt += `Use bullet points for lists within analytical sections.\n`;
    prompt += `Use proper H2 (##) for main sections and H3 (###) for subsections.\n`;
    prompt += `Format tables properly with | separators and header row.\n\n`;

    // ### DETAILED MARKDOWN FORMATTING SPECIFICATIONS (per FR11)
    prompt += `MANDATORY Markdown Formatting Specifications:\n\n`;

    prompt += `Headers:\n`;
    prompt += `- Main sections: Use ## (H2) format: "## Overview", "## Technical Specifications", etc.\n`;
    prompt += `- Subsections in In-Depth Analysis: Use ### (H3) format: "### Housing Materials", "### Sound Profile", etc.\n`;
    prompt += `- NO H1 (#) headers - start with H2 (##)\n`;
    prompt += `- Headers must match the exact section names specified above\n\n`;

    prompt += `Text Formatting:\n`;
    prompt += `- **Bold** ALL switch names throughout the entire response (e.g., **Cherry MX Red**, **Gateron Oil King**)\n`;
    prompt += `- **Bold** key technical terms on first significant mention (e.g., **actuation force**, **tactile bump**, **pre-travel**)\n`;
    prompt += `- Use *italics* for emphasis on descriptive qualities (e.g., *smooth*, *scratchy*, *crisp*)\n`;
    prompt += `- NO underscores for formatting - use asterisks only\n\n`;

    prompt += `Lists and Bullets:\n`;
    prompt += `- Use standard bullet points (-) for lists within analytical sections\n`;
    prompt += `- Maintain consistent indentation for sub-bullets\n`;
    prompt += `- Each bullet point should be a complete thought or comparison\n\n`;

    prompt += `Table Formatting (for Technical Specifications when comparing 2-3 switches):\n`;
    prompt += `- Use proper Markdown table syntax with | separators\n`;
    prompt += `- Include header row with alignment: | Switch Name | Manufacturer | Type | etc. |\n`;
    prompt += `- Follow with separator row: |-------------|--------------|------|-----|\n`;
    prompt += `- Ensure all data cells are properly aligned\n`;
    prompt += `- Use "N/A" for missing data, not empty cells\n`;
    prompt += `- Include units in cells (e.g., "45g", "2.0mm")\n\n`;

    prompt += `Content Structure:\n`;
    prompt += `- Use blank lines between sections for readability\n`;
    prompt += `- Start each section immediately with its H2 header\n`;
    prompt += `- Use concise but informative paragraphs\n`;
    prompt += `- Avoid excessive whitespace or formatting noise\n\n`;

    // ### CONTENT CONSTRAINTS
    prompt += `Content Constraints:\n`;
    prompt += `STRICTLY base technical specifications on SWITCH_DATA_BLOCKS if provided for a switch.\n`;
    prompt += `If data is N/A or missing from SWITCH_DATA_BLOCKS for a specific field, explicitly state "N/A" or "Data not available for [Switch Name]" for that field in the Technical Specifications section.\n`;
    prompt += `For analytical sections (Sound, Feel, etc.), if database information is sparse, you MAY use your general knowledge but MUST preface it with "Based on general community understanding..." or "Typically, switches with these characteristics...". If citing external knowledge for a switch not in our DB, state "For [Switch Name not in DB], general information suggests...".\n`;
    prompt += `DO NOT invent specifications.\n`;
    prompt += `Maintain a neutral, analytical, yet slightly enthusiastic and expert tone.\n\n`;

    // ### COMPREHENSIVE MISSING DATA HANDLING (per FR5, FR6)
    prompt += `MISSING DATA HANDLING INSTRUCTIONS (Critical - Follow Exactly):\n\n`;

    prompt += `For Technical Specifications Section:\n`;
    prompt += `- If a field is missing from SWITCH_DATA_BLOCKS: Use "N/A" or "Data not available for [Switch Name]"\n`;
    prompt += `- NEVER guess or invent technical specifications\n`;
    prompt += `- If a switch is entirely missing from our database: State "Not in our database" clearly\n`;
    prompt += `- Include confidence indicators when available from the data blocks\n\n`;

    prompt += `For Analytical Sections (Sound, Feel, Housing Materials, etc.):\n`;
    prompt += `When database information is limited, you MAY supplement with general knowledge using these EXACT phrases:\n\n`;

    prompt += `General Knowledge Attribution Templates:\n`;
    prompt += `- "Based on general community understanding, [statement]..."\n`;
    prompt += `- "Typically, switches with these characteristics [statement]..."\n`;
    prompt += `- "According to widely reported user experiences, [statement]..."\n`;
    prompt += `- "General information suggests that [statement]..."\n`;
    prompt += `- "Community consensus indicates that [statement]..."\n\n`;

    prompt += `For Switches Not in Database:\n`;
    prompt += `- Use: "For [Switch Name], not in our database, general information suggests [statement]..."\n`;
    prompt += `- Always clarify when information comes from general knowledge vs our database\n`;
    prompt += `- Maintain transparency about data sources throughout\n\n`;

    prompt += `Quality Guidelines for General Knowledge Usage:\n`;
    prompt += `- Only use well-established, widely-accepted information\n`;
    prompt += `- Avoid speculative or controversial claims\n`;
    prompt += `- Focus on material properties and established switch characteristics\n`;
    prompt += `- When in doubt, state limitations clearly rather than guessing\n\n`;

    prompt += `Confidence and Transparency Requirements:\n`;
    prompt += `- Always distinguish between database facts and general knowledge\n`;
    prompt += `- If mixing sources within a paragraph, clarify each statement's origin\n`;
    prompt += `- Use phrases like "while our database shows [fact], general understanding suggests [inference]"\n`;
    prompt += `- Maintain user trust through clear source attribution\n\n`;

    // ### BEHAVIORAL GUIDELINES
    prompt += `BEHAVIORAL_GUIDELINES:\n`;
    prompt += `Factualness: Highly Factual when data is provided from SWITCH_DATA_BLOCKS. When inferring or using general knowledge due to missing data, clearly indicate this and strive for accuracy based on widely accepted information.\n`;
    prompt += `Analytical Depth: Provide analysis, not just lists of specs. Explain implications of differences.\n`;
    prompt += `Clarity for All Users: While focusing on nuanced differences, explain technical terms briefly if they might be new to a beginner.\n`;
    prompt += `Completeness: Aim to cover all requested sections in the output.\n`;
    prompt += `No Conversational Fluff: Directly generate the structured comparison.\n\n`;

    // Final instruction
    prompt += `Generate the structured comparison now:\n`;

    return prompt;
  }
}

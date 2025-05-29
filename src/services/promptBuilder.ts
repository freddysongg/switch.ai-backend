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
}

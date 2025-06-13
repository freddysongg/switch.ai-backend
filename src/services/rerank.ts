import { AI_CONFIG } from '../config/ai.config.js';
import { ReRankedItem } from '../types/chat.js';
import { DatabaseSanitizer } from '../utils/databaseSanitizer.js';
import { PIIUtils } from '../utils/pii-scrubber.js';
import { GeminiService } from './gemini.js';

interface Switch {
  name: string;
  manufacturer: string;
  type: string | null;
  spring: string | null;
  actuationForce: number | null;
  description_text?: string;
  similarity?: number;
}

export class RerankService {
  private geminiService: GeminiService;

  constructor() {
    this.geminiService = new GeminiService();
  }

  /**
   * Re-ranks switch contexts using LLM to improve relevance to user query
   * @param rawUserQuery The original user query
   * @param contexts Array of switch contexts to re-rank
   * @returns Promise<ReRankedItem[]> Array of re-ranked items with scores and justifications
   */
  async rerankContexts(rawUserQuery: string, contexts: Switch[]): Promise<ReRankedItem[]> {
    try {
      const contextsToRerank = contexts.slice(0, AI_CONFIG.RE_RANK_TOP_N);

      const formattedContexts = this.formatContextsForPrompt(contextsToRerank);

      const prompt = this.buildRerankingPrompt(rawUserQuery, formattedContexts);

      const response = await this.geminiService.generate(
        prompt,
        {
          maxOutputTokens: 2000,
          temperature: 0.1
        },
        {
          intent: 'general_switch_info',
          query: rawUserQuery
        }
      );

      const rerankedItems = this.parseRerankingResponse(response, contextsToRerank);

      return rerankedItems;
    } catch (error) {
      console.error('Error in rerankContexts:', error);

      return this.createFallbackRanking(contexts);
    }
  }

  /**
   * Formats switch contexts into a readable format for the LLM prompt
   */
  private formatContextsForPrompt(contexts: Switch[]): string {
    const { sanitizedContexts, overallSanitizationLog } =
      DatabaseSanitizer.sanitizeSwitchContextArray(contexts);

    if (overallSanitizationLog.length > 0) {
      DatabaseSanitizer.logSanitization('RERANK_SERVICE_CONTEXTS', overallSanitizationLog);
    }

    return sanitizedContexts
      .map((ctx, index) => {
        let formattedContext = `${index + 1}. ${ctx.name}`;
        formattedContext += `\n   Manufacturer: ${ctx.manufacturer}`;
        formattedContext += `\n   Type: ${ctx.type || 'N/A'}`;
        formattedContext += `\n   Spring: ${ctx.spring || 'N/A'}`;
        formattedContext += `\n   Actuation Force: ${ctx.actuationForce ? ctx.actuationForce + 'g' : 'N/A'}`;

        if (ctx.description_text) {
          formattedContext += `\n   Description: ${ctx.description_text}`;
        }

        if (ctx.similarity !== undefined) {
          formattedContext += `\n   Initial Relevance Score: ${ctx.similarity.toFixed(2)}`;
        }

        return formattedContext;
      })
      .join('\n\n');
  }

  /**
   * Builds the re-ranking prompt for the LLM
   */
  private buildRerankingPrompt(userQuery: string, formattedContexts: string): string {
    const scrubbedUserQuery = PIIUtils.scrubUserQuery(userQuery);

    return `You are an expert mechanical keyboard switch analyst. Your task is to re-rank a list of switch contexts based on their relevance to a user's query.

USER QUERY: <user_query>${scrubbedUserQuery}</user_query>

SWITCH CONTEXTS TO RE-RANK:
${formattedContexts}

INSTRUCTIONS:
1. Analyze each switch context and determine its relevance to the user's query
2. Consider factors like:
   - Direct name matches or similar names
   - Relevant specifications (force, travel, materials)
   - Type compatibility (linear, tactile, clicky)
   - Use case alignment (gaming, typing, etc.)
   - Manufacturer relevance

3. Assign a relevance score from 0.0 to 1.0 (where 1.0 is most relevant)
4. Provide a brief justification for each score

OUTPUT FORMAT:
Respond with a valid JSON array containing objects with the following structure:
[
  {
    "item_id": "switch_name_here",
    "relevance_score": 0.85,
    "justification": "Brief explanation of why this switch is relevant to the query"
  }
]

IMPORTANT:
- Include ALL switches from the input list
- Use the exact switch names as item_id values
- Ensure the JSON is valid and parseable
- Keep justifications concise (1-2 sentences)
- Order the array from highest to lowest relevance score

JSON Response:`;
  }

  /**
   * Parses the LLM response and extracts re-ranking information
   */
  private parseRerankingResponse(response: string, originalContexts: Switch[]): ReRankedItem[] {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No valid JSON array found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as ReRankedItem[];

      if (!Array.isArray(parsed)) {
        throw new Error('Response is not a valid array');
      }

      const validItems = parsed.filter(
        (item) => item.item_id && typeof item.relevance_score === 'number' && item.justification
      );

      if (validItems.length === 0) {
        throw new Error('No valid re-ranking items found');
      }

      return validItems;
    } catch (error) {
      console.error('Error parsing re-ranking response:', error);
      console.error('Raw response:', response);

      return this.createFallbackRanking(originalContexts);
    }
  }

  /**
   * Creates a fallback ranking when LLM re-ranking fails
   */
  private createFallbackRanking(contexts: Switch[]): ReRankedItem[] {
    return contexts.map((ctx) => ({
      item_id: ctx.name,
      relevance_score: ctx.similarity || 0.5,
      justification: 'Fallback ranking - original search relevance maintained'
    }));
  }
}

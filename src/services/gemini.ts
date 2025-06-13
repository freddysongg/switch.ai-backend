import {
  GenerationConfig,
  GenerativeModel,
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory
} from '@google/generative-ai';

import { AI_CONFIG } from '../config/ai.config.js';
import { getSecret } from '../config/secrets.js';
import type { QueryIntent } from '../types/analysis.js';
import { classifyError, createErrorResponse, logError } from '../utils/errorHandler.js';

export class GeminiService {
  private model: GenerativeModel | null = null;
  private readonly apiTimeout: number = AI_CONFIG.API_TIMEOUT_MS;

  private getModel(): GenerativeModel {
    if (!this.model) {
      const apiKey = getSecret('GEMINI_API_KEY');

      const genAI = new GoogleGenerativeAI(apiKey);
      this.model = genAI.getGenerativeModel({
        model: AI_CONFIG.GEMINI_MODEL,
        generationConfig: {
          maxOutputTokens: AI_CONFIG.MAX_OUTPUT_TOKENS,
          temperature: AI_CONFIG.TEMPERATURE
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
          }
        ]
      });
    }

    return this.model;
  }

  /**
   * Send a single-shot prompt to Gemini and return the generated text.
   * Uses enhanced error handling with structured fallback responses and timeout protection.
   * @param prompt The complete prompt string for the LLM.
   * @param requestSpecificGenConfig Optional generation config to override defaults for this specific call.
   * @param context Optional context for better error handling (intent, query).
   * @param timeoutMs Optional timeout in milliseconds (defaults to 30 seconds).
   */
  async generate(
    prompt: string,
    requestSpecificGenConfig?: Partial<GenerationConfig>,
    context?: { intent?: QueryIntent; query?: string },
    timeoutMs?: number
  ): Promise<string> {
    const timeout = timeoutMs || this.apiTimeout;

    try {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeout);

      try {
        const chat = this.getModel().startChat({
          history: [],
          generationConfig: requestSpecificGenConfig
        });

        const result = await Promise.race([
          chat.sendMessage(prompt),
          new Promise<never>((_, reject) => {
            abortController.signal.addEventListener('abort', () => {
              reject(new Error(`Gemini API call timed out after ${timeout}ms`));
            });
          })
        ]);

        clearTimeout(timeoutId);
        const response = result.response;

        if (!response) {
          console.warn('Gemini API returned no response object.');
          return this.handleGeminiError(new Error('No response object from Gemini API'), context);
        }

        if (!response.candidates || response.candidates.length === 0) {
          console.warn('Gemini API returned no candidates in response.');
          if (response.promptFeedback && response.promptFeedback.blockReason) {
            console.warn(
              `Prompt blocked by Gemini API due to: ${response.promptFeedback.blockReason}`
            );
            return `I am unable to respond to this query as it was blocked due to: ${response.promptFeedback.blockReason}.`;
          }
          return this.handleGeminiError(new Error('No candidates in response'), context);
        }

        const candidate = response.candidates[0];
        if (
          candidate.finishReason &&
          candidate.finishReason !== 'STOP' &&
          candidate.finishReason !== 'MAX_TOKENS'
        ) {
          console.warn(`Gemini generation finished prematurely due to: ${candidate.finishReason}.`);
          if (candidate.finishReason === 'SAFETY') {
            return "I'm sorry, I cannot provide a response to that query due to safety guidelines.";
          }
          return this.handleGeminiError(
            new Error(`Generation finished: ${candidate.finishReason}`),
            context
          );
        }

        const text = (candidate.content?.parts?.map((part) => part.text).join('') || '').trim();

        return text.length > 0
          ? text
          : this.handleGeminiError(new Error('Empty response text'), context);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: any) {
      console.error('GeminiService error during generation:', error.message || error);

      if (error.message?.includes('timed out')) {
        return this.handleGeminiError(
          new Error(`API call timed out after ${timeout}ms. Please try again.`),
          context
        );
      }

      return this.handleGeminiError(error, context);
    }
  }

  /**
   * Enhanced error handling that provides structured responses instead of generic fallback
   */
  private handleGeminiError(
    error: any,
    context?: { intent?: QueryIntent; query?: string }
  ): string {
    const classification = classifyError(error, { source: 'GeminiService' });

    logError(classification, context);

    if (classification.type === 'api_quota_exceeded' && context) {
      const errorResponse = createErrorResponse(
        classification,
        context.intent || 'general_switch_info',
        context.query
      );

      return JSON.stringify(errorResponse, null, 2);
    }

    return AI_CONFIG.FALLBACK_ERROR_MESSAGE_LLM;
  }
}

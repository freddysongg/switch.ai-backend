/**
 * Claude Service - Anthropic Claude AI Integration
 *
 * This service provides integration with Anthropic's Claude AI API
 * using the @anthropic-ai/sdk package.
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { traceable } from 'langsmith/traceable';

import { AI_CONFIG } from '../config/ai.config.js';
import { getSecret } from '../config/secrets.js';
import type { QueryIntent } from '../types/analysis.js';
import { classifyError, createErrorResponse, logError } from '../utils/errorHandler.js';
import type { ILLMService } from './llm.factory.js';

const CLAUDE_MODEL = 'claude-3-5-haiku-20241022';
const LANGCHAIN_PROJECT = 'switchai-rag-optimization';
const LANGCHAIN_TRACING_V2 = 'true';

if (!process.env.LANGCHAIN_PROJECT) {
  process.env.LANGCHAIN_PROJECT = LANGCHAIN_PROJECT;
}
if (!process.env.LANGCHAIN_TRACING_V2) {
  process.env.LANGCHAIN_TRACING_V2 = LANGCHAIN_TRACING_V2;
}

export class ClaudeService implements ILLMService {
  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = getSecret('CLAUDE_API_KEY');
      if (!apiKey) {
        throw new Error('CLAUDE_API_KEY is not configured.');
      }
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  public generate = traceable(
    async (
      prompt: string,
      _requestSpecificGenConfig?: any, // Kept for interface compatibility
      context?: { intent?: QueryIntent; query?: string },
      timeoutMs?: number
    ): Promise<string> => {
      const timeout = timeoutMs || AI_CONFIG.API_TIMEOUT_MS;
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), timeout);

      try {
        const response = await this.getClient().messages.create(
          {
            model: CLAUDE_MODEL,
            max_tokens: AI_CONFIG.MAX_OUTPUT_TOKENS,
            temperature: AI_CONFIG.TEMPERATURE,
            system: 'You are a helpful assistant for a keyboard switch company.',
            messages: [{ role: 'user', content: prompt }]
          },
          { signal: abortController.signal }
        );

        clearTimeout(timeoutId);

        if (!response.content || response.content.length === 0) {
          console.warn('Claude API returned no content.');
          return this.handleClaudeError(new Error('No content in response'), context);
        }

        const text =
          (response.content[0].type === 'text' ? response.content[0].text : '').trim() || '';

        return text.length > 0
          ? text
          : this.handleClaudeError(new Error('Empty response text'), context);
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('ClaudeService error during generation:', error.message || error);
        return this.handleClaudeError(error, context);
      }
    },
    { name: 'ClaudeService.generate' }
  );

  private handleClaudeError(
    error: any,
    context?: { intent?: QueryIntent; query?: string }
  ): string {
    const classification = classifyError(error, { source: 'ClaudeService' });

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

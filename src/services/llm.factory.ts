/**
 * LLM Factory - Unified LLM Service Interface and Factory
 *
 * This module provides a unified interface for all LLM services and a factory
 * function to create the appropriate LLM service based on environment configuration.
 */

import type { QueryIntent } from '../types/analysis.js';
import { ClaudeService } from './claude.js';
import { GeminiService } from './gemini.js';

/**
 * Unified interface for all LLM services
 */
export interface ILLMService {
  /**
   * Generate text using the LLM service
   * @param prompt - The input prompt for text generation
   * @param requestSpecificGenConfig - Optional request-specific generation configuration
   * @param context - Optional context containing intent and query information
   * @param timeoutMs - Optional timeout in milliseconds
   * @returns Promise resolving to the generated text
   */
  generate(
    prompt: string,
    requestSpecificGenConfig?: any,
    context?: { intent?: QueryIntent; query?: string },
    timeoutMs?: number
  ): Promise<string>;
}

let hasLoggedProvider = false;

/**
 * Factory function to create the appropriate LLM service instance
 * based on the IS_CLAUDE environment variable
 * @returns An instance of the configured LLM service
 */
export function createLlmService(): ILLMService {
  const isClaude = process.env.IS_CLAUDE === 'true';

  if (!hasLoggedProvider) {
    if (isClaude) {
      console.log('🤖 Using Claude (Anthropic) as LLM provider');
    } else {
      console.log('🤖 Using Gemini (Google) as LLM provider');
    }
    hasLoggedProvider = true;
  }

  if (isClaude) {
    return new ClaudeService();
  } else {
    return new GeminiService();
  }
}

/**
 * LLMFactory class - Alternative factory implementation
 */
export class LLMFactory {
  private static instance: ILLMService;

  /**
   * Get a singleton instance of the configured LLM service
   * @returns The configured LLM service instance
   */
  public static getInstance(): ILLMService {
    if (!this.instance) {
      console.log('🏭 LLMFactory: Creating new LLM service instance');
      this.instance = createLlmService();
    }
    return this.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  public static resetInstance(): void {
    this.instance = undefined as any;
  }
}

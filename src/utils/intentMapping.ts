import { QueryIntent } from '../types/analysis.js';

/**
 * Shared intent mapping utility to avoid duplicate logic across services
 */

export type UXMetricsQueryType =
  | 'comparison'
  | 'general_info'
  | 'material_analysis'
  | 'follow_up'
  | 'unknown';

/**
 * Maps raw LLM intent strings to UX metrics queryType enum
 * This is the single source of truth for intent mapping
 */
export function mapIntentToQueryType(intent: string): UXMetricsQueryType {
  switch (intent) {
    case 'switch_comparison':
      return 'comparison';
    case 'general_switch_info':
      return 'general_info';
    case 'material_analysis':
      return 'material_analysis';
    case 'follow_up':
    case 'follow_up_question':
      return 'follow_up';
    default:
      return 'unknown';
  }
}

/**
 * Validates and normalizes intent values from LLM responses
 * Maps common variations to standard intent categories
 */
export function validateIntent(intent: string | null | undefined): QueryIntent {
  if (!intent || typeof intent !== 'string') {
    return 'unknown';
  }

  const validIntents: QueryIntent[] = [
    'general_switch_info',
    'switch_comparison',
    'material_analysis',
    'follow_up_question',
    'unknown'
  ];

  if (validIntents.includes(intent as QueryIntent)) {
    return intent as QueryIntent;
  }

  const intentLower = intent.toLowerCase();
  if (intentLower.includes('comparison') || intentLower.includes('compare')) {
    return 'switch_comparison';
  }
  if (intentLower.includes('material')) {
    return 'material_analysis';
  }
  if (intentLower.includes('follow') || intentLower.includes('context')) {
    return 'follow_up_question';
  }
  if (intentLower.includes('switch') || intentLower.includes('general')) {
    return 'general_switch_info';
  }

  return 'unknown';
}

/**
 * Get human-readable prompt type description for logging
 */
export function getPromptType(intentCategory: string): string {
  switch (intentCategory) {
    case 'switch_comparison':
      return 'Specialized Comparison (2+ switches)';
    case 'material_analysis':
      return 'Material Analysis';
    case 'follow_up_question':
      return 'Follow-up Context';
    case 'general_switch_info':
      return 'General Switch Info';
    default:
      return 'Enhanced General';
  }
}

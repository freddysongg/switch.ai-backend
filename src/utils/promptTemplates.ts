/**
 * Prompt Templates Utility for SwitchAI Response Quality Enhancement
 *
 * Following intentMapping.ts success patterns:
 * - Single source of truth for template management
 * - Deterministic template selection
 * - Comprehensive input handling with fallbacks
 * - Clear type safety with TypeScript interfaces
 *
 * Purpose: Enforce consistent markdown structure output to resolve
 * JSON vs markdown format mismatch (primary root cause of test failures)
 */

import { QueryIntent } from '../types/analysisTypes.js';
import { validateIntent } from './intentMapping.js';

// Template configuration types
export interface TemplateOptions {
  format: 'markdown';
  detailLevel?: 'brief' | 'moderate' | 'detailed';
  includeTables?: boolean;
  includeRecommendations?: boolean;
  maxSwitchesInComparison?: number;
}

export interface PromptTemplate {
  intent: QueryIntent;
  format: 'markdown';
  sections: string[];
  instructions: string;
  build(context: PromptContext): string;
}

export interface PromptContext {
  query: string;
  switches?: string[];
  databaseContext?: any;
  followUpContext?: any;
  options: TemplateOptions;
}

/**
 * Get appropriate prompt template based on intent
 * Following intentMapping's deterministic pattern
 */
export function getPromptTemplate(intent: QueryIntent, options: TemplateOptions): PromptTemplate {
  // Normalize intent using existing success pattern
  const normalizedIntent = validateIntent(intent);

  switch (normalizedIntent) {
    case 'switch_comparison':
      return ComparisonTemplate.build(options);
    case 'general_switch_info':
      return GeneralInfoTemplate.build(options);
    case 'material_analysis':
      return MaterialAnalysisTemplate.build(options);
    case 'follow_up_question':
      return FollowUpTemplate.build(options);
    default:
      return DefaultTemplate.build(options);
  }
}

/**
 * Build complete markdown-enforcing prompt
 * Main entry point following intentMapping usage patterns
 */
export function buildMarkdownPrompt(intent: QueryIntent, context: PromptContext): string {
  const template = getPromptTemplate(intent, context.options);
  return template.build(context);
}

/**
 * Get required markdown sections for an intent type
 * Following intentMapping's mapping pattern
 */
export function getRequiredSections(intent: QueryIntent): string[] {
  const normalizedIntent = validateIntent(intent);

  switch (normalizedIntent) {
    case 'switch_comparison':
      return [
        '## Overview',
        '## Technical Specifications',
        '## Comparative Analysis',
        '## Conclusion'
      ];
    case 'general_switch_info':
      return ['## Overview', '## Technical Specifications', '## Analysis', '## Recommendations'];
    case 'material_analysis':
      return ['## Overview', '## Material Analysis', '## Example Switches', '## Applications'];
    case 'follow_up_question':
      return ['## Overview', '## Analysis', '## Context'];
    default:
      return ['## Overview'];
  }
}

/**
 * Comparison Template for switch_comparison intent
 * Enforces markdown table structure and comparative analysis
 */
class ComparisonTemplate {
  static build(options: TemplateOptions): PromptTemplate {
    return {
      intent: 'switch_comparison',
      format: 'markdown',
      sections: [
        '## Overview',
        '## Technical Specifications',
        '## Comparative Analysis',
        '## Conclusion'
      ],
      instructions: this.getInstructions(options),
      build: (context: PromptContext) => this.buildPrompt(context, options)
    };
  }

  private static getInstructions(options: TemplateOptions): string {
    return `
MANDATORY OUTPUT FORMAT: Valid markdown with the following EXACT structure:

## Overview
[Comprehensive introduction to the switches being compared, including context and key differences]

## Technical Specifications
| Specification | Switch 1 | Switch 2 | Switch 3 |
|---------------|----------|----------|----------|
| Manufacturer | [value] | [value] | [value] |
| Type | [Linear/Tactile/Clicky] | [Linear/Tactile/Clicky] | [Linear/Tactile/Clicky] |
| Actuation Force (g) | [value]g | [value]g | [value]g |
| Bottom-out Force (g) | [value]g | [value]g | [value]g |
| Pre-travel (mm) | [value]mm | [value]mm | [value]mm |
| Total Travel (mm) | [value]mm | [value]mm | [value]mm |

## Comparative Analysis
### Housing Materials
[Detailed comparison of housing materials and their impact]

### Sound Profile
[Comparison of sound characteristics and acoustic properties]

### Performance Aspects
[Analysis of performance differences for different use cases]

## Conclusion
[Summary of key differences and recommendations for different user types]

FORMATTING REQUIREMENTS:
- **Bold** ALL switch names throughout the response
- **Bold** key technical terms on first mention
- Use *italics* for descriptive qualities
- Use proper markdown table syntax with | separators
- Headers must be exactly as specified above
- No JSON objects - markdown text only
`;
  }

  private static buildPrompt(context: PromptContext, options: TemplateOptions): string {
    const baseInstructions = this.getInstructions(options);

    return `You are a knowledgeable keyboard switch expert providing detailed analysis.

${context.databaseContext ? 'DATABASE CONTEXT:\n' + JSON.stringify(context.databaseContext, null, 2) + '\n\n' : ''}

USER QUERY: ${context.query}

${baseInstructions}

Provide a comprehensive comparison following the EXACT markdown structure above.`;
  }
}

/**
 * General Info Template for general_switch_info intent
 * Enforces markdown structure for single switch analysis
 */
class GeneralInfoTemplate {
  static build(options: TemplateOptions): PromptTemplate {
    return {
      intent: 'general_switch_info',
      format: 'markdown',
      sections: ['## Overview', '## Technical Specifications', '## Analysis', '## Recommendations'],
      instructions: this.getInstructions(options),
      build: (context: PromptContext) => this.buildPrompt(context, options)
    };
  }

  private static getInstructions(options: TemplateOptions): string {
    return `
MANDATORY OUTPUT FORMAT: Valid markdown with the following EXACT structure:

## Overview
[Comprehensive introduction to the switch, including key characteristics and context]

## Technical Specifications
| Property | Value |
|----------|-------|
| Manufacturer | [manufacturer name] |
| Type | [Linear/Tactile/Clicky] |
| Actuation Force | [value]g |
| Bottom-out Force | [value]g |
| Pre-travel | [value]mm |
| Total Travel | [value]mm |
| Factory Lubed | [Yes/No/Partial] |

## Analysis
[Detailed analysis of the switch characteristics, sound profile, feel, and performance]

## Recommendations
- **Gaming**: [Suitability and characteristics for gaming use]
- **Typing**: [Suitability and characteristics for typing work]
- **Office Environment**: [Noise considerations and workplace suitability]
- **Enthusiast Modifications**: [Modding potential and compatibility]

FORMATTING REQUIREMENTS:
- **Bold** ALL switch names throughout the response
- **Bold** key technical terms on first mention
- Use *italics* for descriptive qualities
- Use proper markdown table syntax with | separators
- Headers must be exactly as specified above
- No JSON objects - markdown text only
`;
  }

  private static buildPrompt(context: PromptContext, options: TemplateOptions): string {
    const baseInstructions = this.getInstructions(options);

    return `You are a knowledgeable keyboard switch expert providing detailed analysis.

${context.databaseContext ? 'DATABASE CONTEXT:\n' + JSON.stringify(context.databaseContext, null, 2) + '\n\n' : ''}

USER QUERY: ${context.query}

${baseInstructions}

Provide comprehensive information following the EXACT markdown structure above.`;
  }
}

/**
 * Material Analysis Template for material_analysis intent
 * Enforces markdown structure for material-focused content
 */
class MaterialAnalysisTemplate {
  static build(options: TemplateOptions): PromptTemplate {
    return {
      intent: 'material_analysis',
      format: 'markdown',
      sections: ['## Overview', '## Material Analysis', '## Example Switches', '## Applications'],
      instructions: this.getInstructions(options),
      build: (context: PromptContext) => this.buildPrompt(context, options)
    };
  }

  private static getInstructions(options: TemplateOptions): string {
    return `
MANDATORY OUTPUT FORMAT: Valid markdown with the following EXACT structure:

## Overview
[Introduction to the material and its importance in keyboard switches]

## Material Analysis
[Comprehensive analysis of material properties, characteristics, and technical details]

## Example Switches
- **Switch Name 1**: [Brief description of how this material is used]
- **Switch Name 2**: [Brief description of how this material is used]
- **Switch Name 3**: [Brief description of how this material is used]

## Applications
[Practical applications, benefits, and considerations for this material in switch design]

FORMATTING REQUIREMENTS:
- **Bold** ALL switch names and material names throughout
- **Bold** key technical terms on first mention
- Use *italics* for material properties and characteristics
- Use bullet points for examples and applications
- Headers must be exactly as specified above
- No JSON objects - markdown text only
`;
  }

  private static buildPrompt(context: PromptContext, options: TemplateOptions): string {
    const baseInstructions = this.getInstructions(options);

    return `You are a knowledgeable materials expert specializing in keyboard switch components.

${context.databaseContext ? 'DATABASE CONTEXT:\n' + JSON.stringify(context.databaseContext, null, 2) + '\n\n' : ''}

USER QUERY: ${context.query}

${baseInstructions}

Provide detailed material analysis following the EXACT markdown structure above.`;
  }
}

/**
 * Follow-up Template for follow_up_question intent
 * Enforces markdown structure for contextual responses
 */
class FollowUpTemplate {
  static build(options: TemplateOptions): PromptTemplate {
    return {
      intent: 'follow_up_question',
      format: 'markdown',
      sections: ['## Overview', '## Analysis', '## Context'],
      instructions: this.getInstructions(options),
      build: (context: PromptContext) => this.buildPrompt(context, options)
    };
  }

  private static getInstructions(options: TemplateOptions): string {
    return `
MANDATORY OUTPUT FORMAT: Valid markdown with the following EXACT structure:

## Overview
[Introduction connecting to previous context and addressing the follow-up question]

## Analysis
[Detailed analysis specific to the follow-up question with relevant context]

## Context
[How this information relates to the previous conversation and additional considerations]

FORMATTING REQUIREMENTS:
- **Bold** ALL switch names throughout the response
- **Bold** key technical terms on first mention
- Use *italics* for descriptive qualities
- Reference previous context appropriately
- Headers must be exactly as specified above
- No JSON objects - markdown text only
`;
  }

  private static buildPrompt(context: PromptContext, options: TemplateOptions): string {
    const baseInstructions = this.getInstructions(options);

    return `You are a knowledgeable keyboard switch expert continuing a conversation.

${context.followUpContext ? 'PREVIOUS CONTEXT:\n' + JSON.stringify(context.followUpContext, null, 2) + '\n\n' : ''}
${context.databaseContext ? 'DATABASE CONTEXT:\n' + JSON.stringify(context.databaseContext, null, 2) + '\n\n' : ''}

USER QUERY: ${context.query}

${baseInstructions}

Provide contextual analysis following the EXACT markdown structure above.`;
  }
}

/**
 * Default Template for unknown or edge case intents
 * Following intentMapping's safe fallback pattern
 */
class DefaultTemplate {
  static build(options: TemplateOptions): PromptTemplate {
    return {
      intent: 'unknown',
      format: 'markdown',
      sections: ['## Overview'],
      instructions: this.getInstructions(options),
      build: (context: PromptContext) => this.buildPrompt(context, options)
    };
  }

  private static getInstructions(options: TemplateOptions): string {
    return `
MANDATORY OUTPUT FORMAT: Valid markdown with the following structure:

## Overview
[Helpful response addressing the user's query with available information and guidance]

FORMATTING REQUIREMENTS:
- **Bold** ALL switch names and key terms
- Use *italics* for descriptive qualities
- Provide helpful guidance when information is limited
- No JSON objects - markdown text only
`;
  }

  private static buildPrompt(context: PromptContext, options: TemplateOptions): string {
    const baseInstructions = this.getInstructions(options);

    return `You are a knowledgeable keyboard switch expert providing helpful guidance.

USER QUERY: ${context.query}

${baseInstructions}

Provide a helpful response following the markdown structure above.`;
  }
}

/**
 * Edge Case Templates for specific error scenarios
 * Following intentMapping's comprehensive fallback pattern
 */
export function getEdgeCaseTemplate(errorType: EdgeCaseType, context: any): PromptTemplate {
  switch (errorType) {
    case 'vague_query':
      return VagueQueryTemplate.build(context);
    case 'unknown_switch':
      return UnknownSwitchTemplate.build(context);
    case 'mixed_validity':
      return MixedValidityTemplate.build(context);
    default:
      return DefaultTemplate.build({ format: 'markdown' });
  }
}

export type EdgeCaseType = 'vague_query' | 'unknown_switch' | 'mixed_validity';

class VagueQueryTemplate {
  static build(context: any): PromptTemplate {
    return {
      intent: 'unknown',
      format: 'markdown',
      sections: ['## Overview', '## Helpful Guidance', '## Next Steps'],
      instructions: `
MANDATORY OUTPUT FORMAT: Valid markdown with helpful guidance:

## Overview
[Acknowledge the query and explain what specific information would be helpful]

## Helpful Guidance
- [Suggestion 1 for clarification]
- [Suggestion 2 for clarification]  
- [Suggestion 3 for clarification]

## Next Steps
[Guide the user toward a more specific query that can be answered effectively]
`,
      build: (
        promptContext: PromptContext
      ) => `You are a helpful keyboard switch expert guiding a user toward a more specific query.

USER QUERY: ${promptContext.query}

The query needs clarification to provide the most helpful response. Follow the EXACT markdown structure above to guide the user.`
    };
  }
}

class UnknownSwitchTemplate {
  static build(context: any): PromptTemplate {
    return {
      intent: 'unknown',
      format: 'markdown',
      sections: ['## Overview', '## Alternative Suggestions', '## How to Help'],
      instructions: `
MANDATORY OUTPUT FORMAT: Valid markdown with helpful alternatives:

## Overview
[Acknowledge that the specific switch wasn't found and offer to help]

## Alternative Suggestions
- **Similar Switch 1**: [Brief description]
- **Similar Switch 2**: [Brief description]
- **Similar Switch 3**: [Brief description]

## How to Help
[Guide on providing more details or checking spelling/manufacturer]
`,
      build: (
        promptContext: PromptContext
      ) => `You are a helpful keyboard switch expert dealing with an unknown switch request.

USER QUERY: ${promptContext.query}

The specific switch wasn't found in available information. Follow the EXACT markdown structure above to provide helpful alternatives.`
    };
  }
}

class MixedValidityTemplate {
  static build(context: any): PromptTemplate {
    return {
      intent: 'unknown',
      format: 'markdown',
      sections: ['## Overview', '## Available Information', '## Missing Information'],
      instructions: `
MANDATORY OUTPUT FORMAT: Valid markdown processing partial information:

## Overview
[Acknowledge the mixed query and explain what can be provided]

## Available Information
[Provide analysis for the valid/known switches or information]

## Missing Information
[Clearly state what information is not available and suggest alternatives]
`,
      build: (
        promptContext: PromptContext
      ) => `You are a helpful keyboard switch expert processing a partially valid query.

USER QUERY: ${promptContext.query}

Some information is available while other parts are unclear. Follow the EXACT markdown structure above to provide what's available and guide on missing parts.`
    };
  }
}

/**
 * Utility functions following intentMapping patterns
 */

/**
 * Validate template configuration
 * Following intentMapping's validation pattern
 */
export function validateTemplateOptions(options: TemplateOptions): TemplateOptions {
  return {
    format: 'markdown',
    detailLevel: options.detailLevel || 'moderate',
    includeTables: options.includeTables !== false,
    includeRecommendations: options.includeRecommendations !== false,
    maxSwitchesInComparison: options.maxSwitchesInComparison || 4
  };
}

/**
 * Get human-readable template description
 * Following intentMapping's getPromptType pattern
 */
export function getTemplateDescription(intent: QueryIntent): string {
  const normalizedIntent = validateIntent(intent);

  switch (normalizedIntent) {
    case 'switch_comparison':
      return 'Markdown Comparison Template (enforces table structure)';
    case 'general_switch_info':
      return 'Markdown General Info Template (enforces specifications table)';
    case 'material_analysis':
      return 'Markdown Material Analysis Template (enforces examples structure)';
    case 'follow_up_question':
      return 'Markdown Follow-up Template (enforces contextual structure)';
    default:
      return 'Markdown Default Template (basic structure)';
  }
}

/**
 * Debug function to check template selection
 * Following intentMapping's transparent logic pattern
 */
export function debugTemplateSelection(intent: string, options: TemplateOptions): any {
  return {
    originalIntent: intent,
    normalizedIntent: validateIntent(intent),
    selectedTemplate: getTemplateDescription(validateIntent(intent)),
    options: validateTemplateOptions(options),
    requiredSections: getRequiredSections(validateIntent(intent))
  };
}

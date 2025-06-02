import {
  CHARACTERISTIC_UNDERSTANDING_PROMPT,
  SWITCH_CHARACTERISTICS
} from '../config/materialProperties.js';
import { GeminiService } from '../services/gemini.js';
import { SwitchQueryService } from './switchQuery.js';
import {
  CharacteristicsAnalysisResult,
  ProcessedComparisonRequest,
  SwitchCandidate
} from '../types/comparison.js';

export class CharacteristicsComparisonService {
  private geminiService: GeminiService;
  private switchQueryService: SwitchQueryService;

  constructor(geminiApiKey: string) {
    this.geminiService = new GeminiService();
    this.switchQueryService = new SwitchQueryService();
  }

  /**
   * Process characteristics-based explanations like "smooth vs clicky"
   * Focuses on explaining the characteristics themselves with illustrative examples
   * Enhanced: Uses AI-powered characteristic understanding
   */
  async processCharacteristicsComparison(
    characteristicPreferences: string[], 
    userQuery: string, 
    confidence: number
  ): Promise<ProcessedComparisonRequest> {
    console.log(
      `🎓 Starting characteristics EXPLANATION for: ${characteristicPreferences.join(' vs ')}`
    );
    console.log(
      `📚 Focus: Educational content about characteristics, not detailed switch comparison`
    );

    try {
      // Step 1: Use AI to understand and normalize the characteristics
      console.log(`🧠 Step 1: AI-powered characteristic understanding...`);
      const understanding = await this.understandCharacteristics(characteristicPreferences);
      console.log(`✅ AI understood characteristics:`, understanding);

      // Use AI-understood characteristics for better accuracy
      const normalizedCharacteristics =
        understanding.characteristics.length > 0
          ? understanding.characteristics
          : characteristicPreferences;

      console.log(`📊 Using characteristics: ${normalizedCharacteristics.join(' vs ')}`);

      // Step 2: Gather multiple examples from each characteristic category (now AI-enhanced)
      console.log(`🔍 Step 2: Gathering examples using AI-enhanced characteristic mapping...`);
      const exampleSwitches = await this.gatherCharacteristicExamples(normalizedCharacteristics);
      console.log(
        `📊 Found examples:`,
        Object.keys(exampleSwitches).map(
          (char) => `${char}: ${exampleSwitches[char].length} switches`
        )
      );

      // Step 3: Generate characteristics explanation content
      console.log(`🧠 Step 3: Generating educational content about characteristics...`);
      const analysisResult = await this.generateCharacteristicsExplanation(
        normalizedCharacteristics,
        exampleSwitches,
        userQuery
      );

      // Return as valid comparison but with special processing note
      return {
        isValidComparison: true,
        switchesToCompare: [],
        confidence: Math.max(confidence, understanding.confidence, 0.95),
        originalQuery: userQuery,
        processingNote: `AI-enhanced characteristics explanation: ${normalizedCharacteristics.join(' vs ')} with illustrative examples (AI confidence: ${understanding.confidence})`,
        isCharacteristicsExplanation: true,
        characteristicsExamples: exampleSwitches
      };
    } catch (error) {
      console.error(`❌ AI-enhanced characteristics explanation processing failed:`, error);
      
      console.log(`🔄 Falling back to basic characteristics explanation...`);
      return {
        isValidComparison: true,
        switchesToCompare: [],
        confidence: 0.8,
        originalQuery: userQuery,
        processingNote: `Basic characteristics explanation: ${characteristicPreferences.join(' vs ')}`
      };
    }
  }

  /**
   * Gather multiple example switches for each characteristic (5 per category)
   * Uses random sampling to provide variety
   * Enhanced: Uses AI knowledge when database examples are insufficient
   */
  private async gatherCharacteristicExamples(
    characteristics: string[]
  ): Promise<Record<string, SwitchCandidate[]>> {
    const examples: Record<string, SwitchCandidate[]> = {};
    const EXAMPLES_PER_CATEGORY = 5;

    for (const characteristic of characteristics) {
      const char = characteristic.toLowerCase();
      console.log(`🎯 Gathering examples for "${char}"...`);

      try {
        let allCandidates: SwitchCandidate[] = [];

        allCandidates =
          await this.switchQueryService.findAllSwitchesForCharacteristicAI(characteristic);

        const randomExamples = this.randomlySelectSwitches(allCandidates, EXAMPLES_PER_CATEGORY);
        examples[characteristic] = randomExamples;

        console.log(
          `✅ Selected ${randomExamples.length} random examples for "${char}": ${randomExamples.map((s) => s.name).join(', ')}`
        );

        if (randomExamples.length < 3) {
          console.log(`🧠 Few database examples for "${char}" - adding AI knowledge examples...`);
          const aiExamples = await this.generateAIKnowledgeExamples(char);
          examples[characteristic] = [...randomExamples, ...aiExamples];
          console.log(`🤖 Enhanced with AI examples: ${aiExamples.map((s) => s.name).join(', ')}`);
        }
      } catch (error) {
        console.error(`❌ Error gathering examples for "${char}":`, error);

        console.log(`🔄 Database failed for "${char}" - using AI knowledge examples only`);
        const aiExamples = await this.generateAIKnowledgeExamples(char);
        examples[characteristic] = aiExamples;
        console.log(`🤖 Using AI knowledge examples: ${aiExamples.map((s) => s.name).join(', ')}`);
      }
    }

    return examples;
  }

  /**
   * Randomly select switches from a pool to ensure variety
   */
  private randomlySelectSwitches(switches: SwitchCandidate[], count: number): SwitchCandidate[] {
    if (switches.length <= count) {
      return switches;
    }

    const shuffled = [...switches].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Generate educational content about characteristics using Gemini
   */
  private async generateCharacteristicsExplanation(
    characteristics: string[], 
    examples: Record<string, SwitchCandidate[]>,
    userQuery: string
  ): Promise<CharacteristicsAnalysisResult> {
    console.log(`🧠 Generating educational content about characteristics...`);
    
    try {
      const prompt = this.buildCharacteristicsEducationPrompt(characteristics, examples, userQuery);
      
      const response = await this.geminiService.generate(prompt);
      console.log(`🤖 Received characteristics explanation from Gemini`);
      
      return {
        selectedSwitches: [], 
        analysis: response
      };
    } catch (error) {
      console.error(`❌ Gemini explanation generation failed:`, error);
      
      return {
        selectedSwitches: [],
        analysis: `Educational overview of ${characteristics.join(' vs ')} characteristics in mechanical keyboard switches.`
      };
    }
  }

  /**
   * Build educational prompt focusing on characteristics explanation
   */
  private buildCharacteristicsEducationPrompt(
    characteristics: string[], 
    examples: Record<string, SwitchCandidate[]>,
    userQuery: string
  ): string {
    let examplesSection = '';
    let hasRealDatabaseExamples = false;
    let hasAIKnowledgeExamples = false;

    for (const [characteristic, switches] of Object.entries(examples)) {
      if (switches.length > 0) {
        examplesSection += `\n**${characteristic.toUpperCase()} EXAMPLES:**\n`;
        switches.forEach((sw) => {
          examplesSection += `- ${sw.name} (${sw.manufacturer}) - ${sw.type || 'Unknown type'}${sw.actuationForce ? `, ${sw.actuationForce}g` : ''}\n`;
        });

        if (
          switches.some(
            (s) => s.description.includes('Classic') || s.description.includes('Premium')
          )
        ) {
          hasAIKnowledgeExamples = true;
        } else {
          hasRealDatabaseExamples = true;
        }
      }
    }

    return `You are a mechanical keyboard expert providing EDUCATIONAL CONTENT about switch characteristics. The user wants to understand the differences between: ${characteristics.join(' vs ')}.

User query: "${userQuery}"

IMPORTANT: This is NOT a detailed switch comparison. Focus on EXPLAINING THE CHARACTERISTICS THEMSELVES - what they mean, how they're achieved, what materials/mechanisms create these effects, and how they affect the typing experience.

${
  hasAIKnowledgeExamples
    ? `
NOTE: Some examples below may not be in our current database but are well-known switches in the mechanical keyboard community. Use your extensive knowledge about these switches to provide accurate information.`
    : ''
}

Example switches ${hasRealDatabaseExamples ? 'from our database' : 'from the mechanical keyboard community'} (use these as brief illustrations, not detailed comparisons):
${examplesSection}

Structure your response as an educational guide focusing on CHARACTERISTICS EDUCATION:

## Understanding ${characteristics.join(' vs ')} Characteristics

### What Makes a Switch "${characteristics[0]}"?
[Explain the characteristic itself - what this term means, how it's achieved through design, materials, and mechanisms. Focus on the CONCEPT, not specific switches.]

${
  characteristics[1]
    ? `### What Makes a Switch "${characteristics[1]}"?
[Explain this characteristic - what this term means, how it's achieved through design, materials, and mechanisms. Focus on the CONCEPT, not specific switches.]`
    : ''
}

### Material Science & Engineering:
[Explain how different components contribute to these characteristics:
- Housing materials (PC for crisp sound, Nylon for deeper sound, POM for smooth feel)
- Stem materials (POM stems for smoothness, different plastics for different textures)
- Spring weights and designs (how they affect actuation force and feel)
- Lubrication and factory modifications
Focus on the SCIENCE behind the characteristics.]

### Mechanism & Design Principles:
[Explain HOW these characteristics are achieved:
- Linear: No tactile bump, smooth motion throughout
- Clicky: Click jacket mechanism, how the click is generated
- Tactile: How bumps are created through leaf design
- Silent: Dampening methods, rubber padding
Focus on ENGINEERING principles.]

### Sound & Feel Differences:
[Explain how these characteristics translate to actual typing experience:
- Sound profiles (frequency, pitch, resonance)
- Tactile feedback differences
- Typing rhythm and flow
- Fatigue considerations
Focus on USER EXPERIENCE differences.]

### Practical Applications:
[Brief mentions of when you might choose each characteristic:
- Gaming scenarios
- Typing scenarios  
- Office environments
- Programming/coding
Focus on USE CASE guidance.]

### Example Context:
[BRIEFLY mention the example switches to demonstrate your points, but keep focus on the characteristics themselves. Use phrases like "For instance, switches like [name] demonstrate [characteristic] through [specific design element]"]

Remember: This is EDUCATIONAL CONTENT about characteristics themselves. The goal is to help users understand what these terms mean, how they're achieved in switch design, and what to expect from each characteristic type. Keep switch mentions brief and illustrative.`;
  }

  /**
   * Generate AI knowledge examples when database examples are insufficient
   * Uses Gemini AI to generate appropriate examples based on characteristics
   */
  private async generateAIKnowledgeExamples(characteristic: string): Promise<SwitchCandidate[]> {
    const char = characteristic.toLowerCase();
    console.log(`🤖 Generating AI knowledge examples for characteristic: "${char}"`);

    try {
      const prompt = `
MECHANICAL_KEYBOARD_SWITCH_EXAMPLES_GENERATOR

Task: Generate 3-5 realistic examples of mechanical keyboard switches that exemplify the "${characteristic}" characteristic.

Characteristic: "${characteristic}"

Instructions:
1. Provide well-known, real mechanical keyboard switches that are good examples of this characteristic
2. Include variety in manufacturers (Cherry, Gateron, Kailh, etc.)
3. Include different force ratings where appropriate
4. Provide accurate information based on actual switch specifications
5. Focus on switches that are commonly available and well-regarded

Response format (JSON only):
{
  "examples": [
    {
      "name": "Switch Name",
      "manufacturer": "Manufacturer",
      "type": "Linear|Tactile|Clicky",
      "actuationForce": force_in_grams_or_null,
      "description": "Brief description of why this exemplifies the characteristic"
    }
  ]
}

Example for "smooth":
{
  "examples": [
    {
      "name": "Gateron Oil King",
      "manufacturer": "Gateron",
      "type": "Linear", 
      "actuationForce": 55,
      "description": "Factory-lubed linear switch known for exceptionally smooth feel"
    }
  ]
}
`;

      const result = await this.geminiService.generate(prompt);
      console.log(`🤖 Received AI examples response for "${char}"`);

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(`⚠️ No JSON found in AI response for "${char}" - using fallback`);
        return this.getFallbackExamples(char);
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.examples || !Array.isArray(parsed.examples)) {
        console.warn(`⚠️ Invalid response format for "${char}" - using fallback`);
        return this.getFallbackExamples(char);
      }

      console.log(`✅ Generated ${parsed.examples.length} AI examples for "${char}"`);
      return parsed.examples.map((example: any) => ({
        name: example.name,
        manufacturer: example.manufacturer,
        type: example.type,
        actuationForce: example.actuationForce,
        description: example.description
      }));
    } catch (error) {
      console.error(`❌ AI example generation failed for "${char}":`, error);
      return this.getFallbackExamples(char);
    }
  }

  /**
   * Get minimal fallback examples when AI generation fails
   * Uses database queries to find actual switches that match characteristics
   */
  private async getFallbackExamples(characteristic: string): Promise<SwitchCandidate[]> {
    console.log(`🔄 Getting fallback examples for "${characteristic}" from database`);

    try {
      const dbExamples =
        await this.switchQueryService.findAllSwitchesForCharacteristicAI(characteristic);

      if (dbExamples.length > 0) {
        console.log(`✅ Found ${dbExamples.length} database examples for "${characteristic}"`);
        return this.randomlySelectSwitches(dbExamples, 3);
      }

      console.log(`⚠️ No database examples found for "${characteristic}" - using generic fallback`);

      return [];
    } catch (error) {
      console.error(`❌ Fallback example generation failed for "${characteristic}":`, error);
      return [];
    }
  }

  /**
   * AI-Powered characteristic understanding and normalization
   * Handles typos, synonyms, and variations using Gemini
   */
  private async understandCharacteristics(userInput: string[]): Promise<{
    characteristics: string[];
    confidence: number;
    interpretations: Record<string, string>;
  }> {
    console.log(`🧠 AI-powered characteristic understanding for: ${userInput.join(', ')}`);

    try {
      const prompt = `${CHARACTERISTIC_UNDERSTANDING_PROMPT}

User input characteristics: ${userInput.join(', ')}

Analyze these terms and map them to standardized characteristics. Handle any typos or variations.`;

      const response = await this.geminiService.generate(prompt);
      console.log(`🤖 Raw Gemini response:`, response.substring(0, 200) + '...');

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(`✅ Parsed characteristic understanding:`, parsed);

        const validCharacteristics = parsed.characteristics.filter((char: string) =>
          SWITCH_CHARACTERISTICS.hasOwnProperty(char)
        );

        return {
          characteristics: validCharacteristics,
          confidence: parsed.confidence || 0.8,
          interpretations: parsed.interpretations || {}
        };
      } else {
        console.warn(
          `⚠️ Could not parse JSON from Gemini response, falling back to direct mapping`
        );
        return this.fallbackCharacteristicMapping(userInput);
      }
    } catch (error) {
      console.error(`❌ AI characteristic understanding failed:`, error);
      return this.fallbackCharacteristicMapping(userInput);
    }
  }

  /**
   * Fallback characteristic mapping when AI fails
   */
  private fallbackCharacteristicMapping(userInput: string[]): {
    characteristics: string[];
    confidence: number;
    interpretations: Record<string, string>;
  } {
    console.log(`🔄 Using fallback characteristic mapping`);

    const characteristics: string[] = [];
    const interpretations: Record<string, string> = {};

    for (const input of userInput) {
      const inputLower = input.toLowerCase();

      for (const [key, definition] of Object.entries(SWITCH_CHARACTERISTICS)) {
        const allTerms = [
          definition.primaryName,
          ...definition.synonyms,
          ...definition.variations,
          ...definition.commonTypos
        ].map((term) => term.toLowerCase());

        if (allTerms.some((term) => inputLower.includes(term) || term.includes(inputLower))) {
          if (!characteristics.includes(key)) {
            characteristics.push(key);
            interpretations[key] =
              `Mapped "${input}" to "${definition.primaryName}" based on similarity`;
          }
        break;
        }
      }
    }

    return {
      characteristics,
      confidence: 0.7,
      interpretations
    };
  }
}

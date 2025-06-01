import { HOUSING_MATERIALS, STEM_MATERIALS } from '../../../config/materialProperties.js';
import { SwitchQueryService } from '../database/switchQuery.js';
import { ProcessedComparisonRequest } from './types.js';

export class MaterialComparisonService {
  private switchQueryService: SwitchQueryService;

  constructor() {
    this.switchQueryService = new SwitchQueryService();
  }

  /**
   * Enhanced material comparison processing with AI fallback and comprehensive analysis
   * No longer depends solely on database - uses AI knowledge for comprehensive material analysis
   */
  async processMaterialComparison(
    materialPreferences: string[],
    userQuery: string,
    confidence: number
  ): Promise<ProcessedComparisonRequest> {
    console.log(
      `🧪 Starting comprehensive material comparison for: ${materialPreferences.join(' vs ')}`
    );

    try {
      // Step 1: Normalize material names and find database examples
      console.log(`🔍 Step 1: Normalizing material names and finding database examples...`);
      const normalizedMaterials = this.normalizeMaterialNames(materialPreferences);
      console.log(`📝 Normalized materials: ${normalizedMaterials.join(', ')}`);

      const databaseExamples =
        await this.switchQueryService.findSwitchesForMaterialComparison(materialPreferences);
      console.log(`📊 Found ${databaseExamples.length} database examples`);

      // Step 2: Generate material analysis
      console.log(
        `🧠 Step 2: Material comparison is educational - no specific switches to compare`
      );

      // Step 3: Mark this as a special material comparison that needs educational content
      console.log(
        `✅ Material comparison processing successful - marking for educational content generation`
      );

      return {
        isValidComparison: true,
        isMaterialsExplanation: true,
        materialsToExplain: normalizedMaterials,
        materialExamples: await this.buildMaterialExamples(normalizedMaterials, databaseExamples),
        switchesToCompare: [],
        confidence: Math.max(confidence, 0.8),
        originalQuery: userQuery,
        userFeedbackMessage: undefined,
        processingNote: `Comprehensive material analysis: ${normalizedMaterials.join(' vs ')} with ${databaseExamples.length} database examples + AI knowledge`
      };
    } catch (error) {
      console.error(`❌ Material comparison processing failed:`, error);

      console.log(`🔄 Falling back to pure AI material knowledge...`);
      return {
        isValidComparison: true,
        isMaterialsExplanation: true,
        materialsToExplain: materialPreferences,
        materialExamples: {},
        switchesToCompare: [],
        confidence: 0.7,
        originalQuery: userQuery,
        processingNote: `AI-powered material analysis: ${materialPreferences.join(' vs ')} (pure AI knowledge)`
      };
    }
  }

  /**
   * Normalize material names to standard forms
   */
  private normalizeMaterialNames(materials: string[]): string[] {
    const normalizedMaterials: string[] = [];

    for (const material of materials) {
      const lower = material.toLowerCase().trim();

      // Map common aliases to standard names
      if (lower === 'pc' || lower === 'polycarbonate') {
        normalizedMaterials.push('polycarbonate');
      } else if (lower === 'pom' || lower === 'polyoxymethylene') {
        normalizedMaterials.push('POM');
      } else if (lower === 'nylon' || lower === 'pa' || lower === 'pa66') {
        normalizedMaterials.push('nylon');
      } else if (lower === 'pa12' || lower === 'nylon 12') {
        normalizedMaterials.push('PA12');
      } else if (lower === 'uhmwpe' || lower.includes('ultra-high')) {
        normalizedMaterials.push('UHMWPE');
      } else if (lower === 'pok' || lower === 'polyketone') {
        normalizedMaterials.push('POK');
      } else if (lower.includes('ink')) {
        normalizedMaterials.push('INK');
      } else {
        // Keep original if no mapping found
        normalizedMaterials.push(material);
      }
    }

    return [...new Set(normalizedMaterials)];
  }

  /**
   * Build material examples from database switches
   */
  private async buildMaterialExamples(
    materials: string[],
    databaseSwitches: string[]
  ): Promise<Record<string, any[]>> {
    const examples: Record<string, any[]> = {};

    for (const material of materials) {
      examples[material] = [];
    }

    // For each material, find example switches from the database
    for (const material of materials) {
      try {
        console.log(`🔍 Finding examples for material: ${material}`);
        const materialExamples =
          await this.switchQueryService.findSwitchesForSpecificMaterial(material);
        examples[material] = materialExamples;
        console.log(`📊 Found ${materialExamples.length} examples for ${material}`);
      } catch (error) {
        console.warn(`⚠️ Failed to find examples for material ${material}:`, error);
        examples[material] = [];
      }
    }

    return examples;
  }

  /**
   * Get material properties from the configuration
   */
  getMaterialProperties(materialName: string): any {
    const normalized = materialName.toLowerCase();

    // Check housing materials
    for (const [key, material] of Object.entries(HOUSING_MATERIALS)) {
      if (key === normalized || material.name.toLowerCase() === normalized) {
        return { ...material, category: 'housing' };
      }
    }

    // Check stem materials
    for (const [key, material] of Object.entries(STEM_MATERIALS)) {
      if (key === normalized || material.name.toLowerCase() === normalized) {
        return { ...material, category: 'stem' };
      }
    }

    return null;
  }
}

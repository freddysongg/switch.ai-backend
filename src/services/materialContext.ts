/**
 * Material Context Service for Enhanced Switch Comparison
 *
 * This service provides dynamic context injection for switch materials,
 * translating database material properties into rich, descriptive context
 * that enhances LLM responses with enthusiast-level terminology.
 */

import {
  HOUSING_MATERIALS,
  SPRING_WEIGHTS,
  STEM_MATERIALS,
  USE_CASE_PREFERENCES,
  type HousingMaterial,
  type SpringWeightCategory,
  type StemMaterial
} from '../config/materialProperties.js';

export interface SwitchMaterialData {
  topHousing: string | null;
  bottomHousing: string | null;
  stem: string | null;
  spring: string | null;
  actuationForce: number | null;
  bottomForce: number | null;
}

export interface MaterialContextBlock {
  materialType: 'housing' | 'stem' | 'spring';
  materialName: string;
  soundCharacteristics: string;
  feelCharacteristics: string;
  enthusiastTerminology: string;
  usageImplications: string;
}

export interface AggregatedMaterialContext {
  contextBlocks: MaterialContextBlock[];
  soundProfile: string;
  feelProfile: string;
  useCaseRecommendations: string;
  enthusiastSummary: string;
}

export class MaterialContextService {
  /**
   * Generate comprehensive material context for a single switch
   *
   * @param switchData - Material data extracted from database
   * @param switchName - Name of the switch for context generation
   * @returns Aggregated material context with sound, feel, and usage information
   */
  generateSwitchContext(
    switchData: SwitchMaterialData,
    switchName: string
  ): AggregatedMaterialContext {
    const contextBlocks: MaterialContextBlock[] = [];
    const soundElements: string[] = [];
    const feelElements: string[] = [];
    const enthusiastTerms: string[] = [];

    const housingContext = this.generateHousingContext(
      switchData.topHousing,
      switchData.bottomHousing
    );
    if (housingContext) {
      contextBlocks.push(housingContext);
      soundElements.push(housingContext.soundCharacteristics);
      feelElements.push(housingContext.feelCharacteristics);
      enthusiastTerms.push(...this.extractEnthusiastTerms(housingContext.enthusiastTerminology));
    }

    const stemContext = this.generateStemContext(switchData.stem);
    if (stemContext) {
      contextBlocks.push(stemContext);
      soundElements.push(stemContext.soundCharacteristics);
      feelElements.push(stemContext.feelCharacteristics);
      enthusiastTerms.push(...this.extractEnthusiastTerms(stemContext.enthusiastTerminology));
    }

    const springContext = this.generateSpringContext(switchData.actuationForce, switchData.spring);
    if (springContext) {
      contextBlocks.push(springContext);
      soundElements.push(springContext.soundCharacteristics);
      feelElements.push(springContext.feelCharacteristics);
      enthusiastTerms.push(...this.extractEnthusiastTerms(springContext.enthusiastTerminology));
    }

    return {
      contextBlocks,
      soundProfile: this.aggregateSoundProfile(soundElements, switchName),
      feelProfile: this.aggregateFeelProfile(feelElements, switchName),
      useCaseRecommendations: this.generateUseCaseRecommendations(switchData),
      enthusiastSummary: this.generateEnthusiastSummary(enthusiastTerms, switchName)
    };
  }

  /**
   * Generate housing material context considering both top and bottom housing materials
   * Handles mixed housing configurations with appropriate analysis
   */
  private generateHousingContext(
    topHousing: string | null,
    bottomHousing: string | null
  ): MaterialContextBlock | null {
    const topMaterial = topHousing ? this.findHousingMaterial(topHousing) : null;
    const bottomMaterial = bottomHousing ? this.findHousingMaterial(bottomHousing) : null;

    if (!topMaterial && !bottomMaterial) return null;

    if (topMaterial && bottomMaterial && topMaterial !== bottomMaterial) {
      return this.generateMixedHousingContext(
        topMaterial,
        bottomMaterial,
        topHousing!,
        bottomHousing!
      );
    }

    const material = topMaterial || bottomMaterial;
    const materialName = topHousing || bottomHousing;

    if (!material) return null;

    return {
      materialType: 'housing',
      materialName: material.name,
      soundCharacteristics: `${material.name} housing contributes ${material.sound.descriptors.join(', ')} sound characteristics with ${material.sound.frequency} frequency response and ${material.sound.resonance} resonance properties`,
      feelCharacteristics: `The ${material.name} housing provides a ${material.feel.descriptors.join(', ')} feel with ${material.feel.texture} texture and ${material.feel.firmness} firmness`,
      enthusiastTerminology: `Enthusiasts describe ${material.name} housings as ${material.enthusiastTerms.join(', ')}`,
      usageImplications: `Commonly used in ${material.commonUse}, ${material.name} housings are ideal for users seeking ${material.sound.descriptors[0]} and ${material.feel.descriptors[0]} characteristics`
    };
  }

  /**
   * Generate context for mixed housing configurations
   * Analyzes the interaction between different top and bottom housing materials
   */
  private generateMixedHousingContext(
    topMaterial: HousingMaterial,
    bottomMaterial: HousingMaterial,
    topName: string,
    bottomName: string
  ): MaterialContextBlock {
    return {
      materialType: 'housing',
      materialName: `${topMaterial.name} top / ${bottomMaterial.name} bottom`,
      soundCharacteristics: `Mixed housing design: ${topMaterial.name} top housing provides ${topMaterial.sound.descriptors.join(', ')} characteristics during key release, while ${bottomMaterial.name} bottom housing contributes ${bottomMaterial.sound.descriptors.join(', ')} properties during bottom-out`,
      feelCharacteristics: `The combination offers ${topMaterial.feel.descriptors[0]} top-out feel with ${bottomMaterial.feel.descriptors[0]} bottom-out characteristics`,
      enthusiastTerminology: `Mixed housing combinations like ${topMaterial.name}/${bottomMaterial.name} create unique sound signatures blending ${topMaterial.enthusiastTerms[0]} and ${bottomMaterial.enthusiastTerms[0]} characteristics`,
      usageImplications: `This housing combination balances the ${topMaterial.sound.frequency} frequency of ${topMaterial.name} with the ${bottomMaterial.sound.frequency} frequency of ${bottomMaterial.name}, creating a nuanced typing experience`
    };
  }

  private generateStemContext(stem: string | null): MaterialContextBlock | null {
    if (!stem) return null;

    const material = this.findStemMaterial(stem);
    if (!material) return null;

    return {
      materialType: 'stem',
      materialName: material.name,
      soundCharacteristics: `${material.name} stem material produces ${material.sound.descriptors.join(', ')} sound qualities with ${material.sound.volume} volume characteristics`,
      feelCharacteristics: `The ${material.name} stem delivers ${material.feel.descriptors.join(', ')} typing feel with ${material.feel.texture} surface properties and ${material.lubrication} lubrication characteristics`,
      enthusiastTerminology: `${material.name} stems are praised for being ${material.enthusiastTerms.join(', ')}`,
      usageImplications: `With ${material.durability} durability and ${material.lubrication} properties, ${material.name} stems are excellent for users prioritizing ${material.feel.descriptors[0]} and ${material.sound.descriptors[0]} characteristics`
    };
  }

  private generateSpringContext(
    actuationForce: number | null,
    springDescription: string | null
  ): MaterialContextBlock | null {
    if (!actuationForce) return null;

    const weightCategory = this.categorizeSpringWeight(actuationForce);
    if (!weightCategory) return null;

    return {
      materialType: 'spring',
      materialName: `${actuationForce}g ${weightCategory.range}`,
      soundCharacteristics: `${weightCategory.range} spring produces ${weightCategory.sound.descriptors.join(', ')} sound with ${weightCategory.sound.frequency} frequency response`,
      feelCharacteristics: `${actuationForce}g actuation force delivers ${weightCategory.feel.descriptors.join(', ')} typing experience with ${weightCategory.feel.firmness} resistance and ${weightCategory.typingSpeed} typing characteristics`,
      enthusiastTerminology: `${weightCategory.range} springs are known for ${weightCategory.enthusiastTerms.join(', ')} characteristics`,
      usageImplications: `This weight is ideal for ${weightCategory.useCases.join(', ')} with ${weightCategory.fatigueLevel} fatigue levels during extended use`
    };
  }

  /**
   * Generate comprehensive material context for multiple switches in a comparison
   *
   * @param switchesData - Array of switches with their material data
   * @returns Formatted context string for prompt injection
   */
  generateComparisonContext(
    switchesData: Array<{ name: string; materials: SwitchMaterialData }>
  ): string {
    const switchContexts = switchesData.map(({ name, materials }) => ({
      name,
      context: this.generateSwitchContext(materials, name)
    }));

    let contextString = 'MATERIAL_CONTEXT_FOR_COMPARISON:\n\n';

    contextString += 'Material Properties Knowledge:\n';
    contextString += this.generateMaterialPropertiesOverview();
    contextString += '\n\n';

    contextString += 'Individual Switch Material Analysis:\n';
    switchContexts.forEach(({ name, context }) => {
      contextString += `\n${name.toUpperCase()} MATERIAL CONTEXT:\n`;
      contextString += `Sound Profile: ${context.soundProfile}\n`;
      contextString += `Feel Profile: ${context.feelProfile}\n`;
      contextString += `Enthusiast Summary: ${context.enthusiastSummary}\n`;
      contextString += `Use Case Recommendations: ${context.useCaseRecommendations}\n`;
    });

    contextString += '\n\nCOMPARATIVE_MATERIAL_INSIGHTS:\n';
    contextString += this.generateComparativeInsights(switchContexts);

    return contextString;
  }

  private generateMaterialPropertiesOverview(): string {
    let overview = '';

    overview += 'Housing Materials:\n';
    overview += '- Nylon: Deep, fuller, thocky sound; dampened resonance; firm feel\n';
    overview += '- Polycarbonate: Sharp, crisp, clacky sound; higher pitch; responsive feel\n';
    overview += '- POM: Quiet, refined, creamy sound; smooth, consistent feel\n';
    overview += '- PA12: Balanced, refined sound; smooth, premium feel\n\n';

    overview += 'Stem Materials:\n';
    overview += '- POM: Smooth, consistent, buttery feel; quiet, stable sound\n';
    overview += '- POK: Ultra-smooth, premium, silk-like feel; refined sound\n';
    overview += '- UHMWPE: Frictionless, whisper-smooth feel; ultra-quiet sound\n\n';

    overview += 'Spring Weight Implications:\n';
    overview += '- Light (30-49g): Fast, responsive, gaming-oriented; low fatigue\n';
    overview += '- Medium (50-69g): Balanced, versatile, all-purpose; moderate characteristics\n';
    overview += '- Heavy (70g+): Deliberate, authoritative, precision-focused; higher fatigue\n';

    return overview;
  }

  /**
   * Generate comparative insights between multiple switches based on their material contexts
   */
  private generateComparativeInsights(
    switchContexts: Array<{ name: string; context: AggregatedMaterialContext }>
  ): string {
    let insights = '';

    const soundProfiles = switchContexts.map((s) => s.context.enthusiastSummary);
    insights +=
      'Sound Profile Comparison: The material combinations create distinct sound signatures - ';
    insights += soundProfiles.join(' versus ') + '\n\n';

    const feelCharacteristics = switchContexts.map((s) => s.context.feelProfile);
    insights += 'Feel Comparison: Material choices result in different typing experiences - ';
    insights += feelCharacteristics.join(' compared to ') + '\n\n';

    insights +=
      'Material-Based Recommendations: Consider material properties when choosing switches for specific use cases. ';
    insights +=
      'Housing materials primarily affect sound signature, stem materials influence smoothness and consistency, ';
    insights +=
      'while spring weights determine actuation characteristics and typing fatigue levels.';

    return insights;
  }

  /**
   * Find housing material data using fuzzy matching for various naming conventions
   */
  private findHousingMaterial(housingName: string): HousingMaterial | null {
    const normalizedName = housingName.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (HOUSING_MATERIALS[normalizedName]) {
      return HOUSING_MATERIALS[normalizedName];
    }

    for (const [key, material] of Object.entries(HOUSING_MATERIALS)) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) {
        return material;
      }

      if (
        material.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .includes(normalizedName)
      ) {
        return material;
      }
    }

    return null;
  }

  private findStemMaterial(stemName: string): StemMaterial | null {
    const normalizedName = stemName.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (STEM_MATERIALS[normalizedName]) {
      return STEM_MATERIALS[normalizedName];
    }

    for (const [key, material] of Object.entries(STEM_MATERIALS)) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) {
        return material;
      }

      if (
        material.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .includes(normalizedName)
      ) {
        return material;
      }
    }

    return null;
  }

  private categorizeSpringWeight(actuationForce: number): SpringWeightCategory | null {
    for (const category of Object.values(SPRING_WEIGHTS)) {
      const [min, max] = category.actuationRange;
      if (actuationForce >= min && actuationForce <= max) {
        return category;
      }
    }
    return null;
  }

  private aggregateSoundProfile(soundElements: string[], switchName: string): string {
    if (soundElements.length === 0)
      return `${switchName} sound characteristics not available from material data`;

    return `${switchName} sound profile: ${soundElements.join('; ')}`;
  }

  private aggregateFeelProfile(feelElements: string[], switchName: string): string {
    if (feelElements.length === 0)
      return `${switchName} feel characteristics not available from material data`;

    return `${switchName} feel profile: ${feelElements.join('; ')}`;
  }

  private generateUseCaseRecommendations(switchData: SwitchMaterialData): string {
    const recommendations: string[] = [];

    if (switchData.actuationForce) {
      const weight = this.categorizeSpringWeight(switchData.actuationForce);
      if (weight) {
        recommendations.push(
          `Recommended for ${weight.useCases.join(', ')} based on ${weight.range} actuation force`
        );
      }
    }

    const housing = this.findHousingMaterial(
      switchData.topHousing || switchData.bottomHousing || ''
    );
    if (housing) {
      if (housing.sound.volume === 'quiet') {
        recommendations.push('Suitable for office environments due to quiet operation');
      } else if (housing.enthusiastTerms.includes('clacky')) {
        recommendations.push('Great for enthusiasts who enjoy pronounced sound feedback');
      }
    }

    return recommendations.length > 0
      ? recommendations.join('; ')
      : 'Use case recommendations depend on personal preference and specific requirements';
  }

  private generateEnthusiastSummary(enthusiastTerms: string[], switchName: string): string {
    if (enthusiastTerms.length === 0)
      return `${switchName} enthusiast characteristics not available`;

    const uniqueTerms = [...new Set(enthusiastTerms)];
    return `${switchName} enthusiast profile: ${uniqueTerms.join(', ')}`;
  }

  private extractEnthusiastTerms(terminology: string): string[] {
    return terminology
      .split(',')
      .map((term) => term.trim())
      .filter((term) => term.length > 0);
  }

  /**
   * Generate use case specific context injection for prompt enhancement
   */
  generateUseCaseContext(detectedUseCase: keyof typeof USE_CASE_PREFERENCES): string {
    const preferences = USE_CASE_PREFERENCES[detectedUseCase];

    let context = `USE_CASE_CONTEXT (${detectedUseCase.toUpperCase()}):\n`;
    context += `Preferred Spring Weights: ${preferences.preferredSpringWeights.join(', ')}\n`;
    context += `Preferred Sound Characteristics: ${preferences.preferredSounds.join(', ')}\n`;
    context += `Key Factors: ${preferences.keyFactors.join(', ')}\n`;
    context += `Context: When evaluating switches for ${detectedUseCase}, prioritize ${preferences.keyFactors[0]} and consider ${preferences.preferredSounds[0]} sound profiles.\n`;

    return context;
  }

  /**
   * Detect use case from user query text using keyword analysis
   */
  detectUseCase(userQuery: string): keyof typeof USE_CASE_PREFERENCES | null {
    const query = userQuery.toLowerCase();

    if (
      query.includes('gaming') ||
      query.includes('game') ||
      query.includes('fps') ||
      query.includes('competitive')
    ) {
      return 'gaming';
    }

    if (
      query.includes('office') ||
      query.includes('work') ||
      query.includes('quiet') ||
      query.includes('professional')
    ) {
      return 'office';
    }

    if (
      query.includes('programming') ||
      query.includes('coding') ||
      query.includes('development') ||
      query.includes('developer')
    ) {
      return 'programming';
    }

    if (query.includes('typing') || query.includes('writing') || query.includes('writer')) {
      return 'typing';
    }

    return null;
  }
}

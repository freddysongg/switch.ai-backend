/**
 * Fallback handling utilities
 * 
 * Provides error recovery and fallback content generation
 * when primary parsing fails.
 */

import { ResponseType } from '../config/responseStructures.js';
import { TextProcessor, ContentAnalyzer } from './textProcessing.js';

/**
 * Fallback content generation utilities
 */
export class FallbackHandler {
  /**
   * Creates enhanced fallback response based on response type
   * 
   * @param markdown - Original markdown content
   * @param responseType - Type of response to generate
   * @param errorInfo - Error information and context
   * @returns Fallback response data
   */
  static createEnhancedFallbackResponse(
    markdown: string,
    responseType: ResponseType,
    errorInfo: any
  ): any {
    const baseMetadata = {
      confidence: 0,
      warnings: [`Parsing failed: ${errorInfo.errorMessage}`],
      limitations: ['This response contains fallback data due to parsing failure'],
      errorDetails: errorInfo,
      processingMode: 'fallback'
    };

    // Try to extract any basic information even in fallback mode
    const basicInfo = this.extractBasicInfoForFallback(markdown);

    switch (responseType) {
      case 'switch_comparison':
        return {
          title: basicInfo.title || 'Switch Comparison (Parse Error)',
          switchNames: basicInfo.switchNames || [],
          overview: this.createFallbackOverview(markdown, errorInfo),
          technicalSpecs: { switches: [] },
          analysis: {
            feelComparison: { title: 'Feel Comparison', content: 'Analysis unavailable due to parsing error' },
            soundComparison: { title: 'Sound Comparison', content: 'Analysis unavailable due to parsing error' },
            buildQualityComparison: { title: 'Build Quality', content: 'Analysis unavailable due to parsing error' },
            performanceComparison: { title: 'Performance', content: 'Analysis unavailable due to parsing error' }
          },
          conclusion: {
            summary: 'Unable to parse comparison details',
            recommendations: { general: 'Please review the original content or try again' },
            keyDifferences: []
          },
          metadata: { 
            ...baseMetadata, 
            switchesCompared: basicInfo.switchNames?.length || 0, 
            allSwitchesFoundInDatabase: false 
          }
        };

      case 'characteristics_explanation':
        return {
          title: basicInfo.title || 'Characteristics Explanation (Parse Error)',
          characteristicsExplained: basicInfo.characteristics || [],
          overview: this.createFallbackOverview(markdown, errorInfo),
          characteristicDetails: [],
          examples: {
            title: 'Examples',
            content: this.extractSectionContent(markdown, ['example', 'instance', 'demonstration']),
            switchExamples: []
          },
          practicalImplications: {
            userExperience: this.extractSectionContent(markdown, ['experience', 'feel', 'typing', 'usage']),
            useCaseRecommendations: {},
            keyConsiderations: TextProcessor.extractKeyDifferences(markdown)
          },
          metadata: {
            ...baseMetadata,
            characteristicsCount: basicInfo.characteristics?.length || 0,
            technicalDepth: 'basic' as const
          }
        };

      case 'material_analysis':
        return {
          title: basicInfo.title || 'Material Analysis (Parse Error)',
          materialsAnalyzed: basicInfo.materials || [],
          overview: this.createFallbackOverview(markdown, errorInfo),
          materialDetails: basicInfo.materials?.map(material => ({
            materialName: this.normalizeMaterialName(material),
            soundCharacteristics: 'Analysis unavailable due to parsing error',
            feelCharacteristics: 'Analysis unavailable due to parsing error',
            durabilityCharacteristics: 'Analysis unavailable due to parsing error',
            advantages: [],
            disadvantages: [],
            switchExamples: []
          })) || [],
          comparisons: {
            title: 'Material Comparisons',
            content: this.extractSectionContent(markdown, ['comparison', 'compare']),
            detailedAnalysis: {
              soundDifferences: 'Comparison unavailable due to parsing error',
              feelDifferences: 'Comparison unavailable due to parsing error',
              durabilityComparison: 'Comparison unavailable due to parsing error',
              housingApplications: 'Application details unavailable'
            },
            keyDistinctions: []
          },
          examples: {
            title: 'Examples',
            content: 'Examples unavailable due to parsing error',
            switchExamples: []
          },
          practicalGuidance: {
            selectionCriteria: 'Guidance unavailable due to parsing error',
            useCaseRecommendations: {},
            keyConsiderations: []
          },
          metadata: {
            ...baseMetadata,
            materialsCount: basicInfo.materials?.length || 0,
            analysisScope: 'single_material' as const,
            technicalDepth: 'basic' as const
          }
        };

      case 'standard_rag':
        return {
          title: basicInfo.title || 'Response (Parse Error)',
          content: {
            mainAnswer: this.createFallbackMainAnswer(markdown, errorInfo),
            additionalContext: errorInfo.hasBasicStructure ? 'Original content contained some structure but could not be parsed' : undefined
          },
          keyPoints: basicInfo.keyPoints || [],
          sourceInformation: {
            sourceTypes: ['general_knowledge'] as const,
            confidenceLevel: 'low' as const,
            limitations: ['Content could not be properly parsed', 'Information may be incomplete or inaccurate']
          },
          metadata: {
            ...baseMetadata,
            responseLength: ContentAnalyzer.determineResponseLength(markdown),
            technicalLevel: 'beginner' as const
          }
        };

      default:
        return {
          title: 'Parsing Error',
          content: 'Unable to parse content due to structural issues',
          metadata: baseMetadata
        };
    }
  }

  /**
   * Extracts basic information for fallback responses
   * 
   * @param markdown - Raw markdown content
   * @returns Basic extracted information
   */
  static extractBasicInfoForFallback(markdown: string): {
    title?: string;
    switchNames?: string[];
    characteristics?: string[];
    materials?: string[];
    keyPoints?: string[];
  } {
    console.log(`🔍 Extracting basic info for fallback from ${markdown.length} characters`);
    
    const result: any = {};
    
    // Extract title from first header or first line
    const firstHeader = markdown.match(/^#{1,6}\s+(.+)$/m);
    if (firstHeader) {
      result.title = firstHeader[1].trim();
    } else {
      const firstLine = TextProcessor.extractFirstLine(markdown);
      if (firstLine && firstLine.length < 100) {
        result.title = firstLine;
      }
    }
    
    // Extract switch names
    result.switchNames = this.extractBasicSwitchNames(markdown);
    
    // Extract characteristics
    result.characteristics = this.extractBasicCharacteristics(markdown);
    
    // Extract materials
    result.materials = this.extractBasicMaterials(markdown);
    
    // Extract key points
    result.keyPoints = TextProcessor.extractBasicKeyPoints(markdown);
    
    console.log(`✅ Extracted basic info: title=${!!result.title}, switches=${result.switchNames?.length || 0}, characteristics=${result.characteristics?.length || 0}`);
    return result;
  }

  /**
   * Creates fallback overview content
   * 
   * @param markdown - Original markdown content
   * @param errorInfo - Error information
   * @returns Fallback overview string
   */
  static createFallbackOverview(markdown: string, errorInfo: any): string {
    const firstParagraph = markdown.split('\n\n')[0];
    if (firstParagraph && firstParagraph.length > 50) {
      return `${firstParagraph}\n\n*Note: Full analysis unavailable due to parsing error.*`;
    }
    
    return `This content could not be properly parsed due to structural issues. Error: ${errorInfo.errorMessage || 'Unknown parsing error'}`;
  }

  /**
   * Creates fallback main answer content
   * 
   * @param markdown - Original markdown content
   * @param errorInfo - Error information
   * @returns Fallback main answer string
   */
  static createFallbackMainAnswer(markdown: string, errorInfo: any): string {
    // Try to extract the most meaningful content
    const lines = markdown.split('\n').filter(line => line.trim().length > 20);
    
    if (lines.length > 0) {
      const meaningfulContent = lines.slice(0, 5).join('\n');
      return `${meaningfulContent}\n\n*Note: This response was generated with limited parsing due to content structure issues.*`;
    }
    
    return `Unable to properly parse the original content. Error: ${errorInfo.errorMessage || 'Content structure could not be analyzed'}`;
  }

  /**
   * Extracts basic switch names from markdown content
   * 
   * @param markdown - Raw markdown content
   * @returns Array of potential switch names
   */
  static extractBasicSwitchNames(markdown: string): string[] {
    const switchNames: Set<string> = new Set();
    
    // Common switch naming patterns
    const switchPatterns = [
      /\b(?:Cherry|Gateron|Kailh|Zealios|NovelKeys|Drop|Durock|JWK|TTC|Outemu|Razer|Logitech|Akko|Glorious)\s+[A-Za-z0-9\s]+(?:Switch|switch)?\b/g,
      /\b[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+Switch)?\b/g,
      /\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g
    ];
    
    for (const pattern of switchPatterns) {
      const matches = markdown.match(pattern) || [];
      matches.forEach(match => {
        const cleaned = match.replace(/\bswitch\b/gi, '').trim();
        if (cleaned.length > 3 && cleaned.length < 50) {
          switchNames.add(cleaned);
        }
      });
    }
    
    return Array.from(switchNames).slice(0, 5);
  }

  /**
   * Extracts basic characteristics from markdown content
   * 
   * @param markdown - Raw markdown content
   * @returns Array of potential characteristics
   */
  static extractBasicCharacteristics(markdown: string): string[] {
    const characteristics: Set<string> = new Set();
    
    // Common characteristics keywords
    const characteristicKeywords = [
      'actuation force', 'travel distance', 'tactile feedback', 'sound',
      'feel', 'smoothness', 'bump', 'click', 'linear', 'tactile', 'clicky',
      'spring weight', 'bottom out', 'pre-travel', 'post-travel'
    ];
    
    const lowerMarkdown = markdown.toLowerCase();
    
    for (const keyword of characteristicKeywords) {
      if (lowerMarkdown.includes(keyword)) {
        characteristics.add(keyword);
      }
    }
    
    // Extract from headers that might be characteristics
    const headers = markdown.match(/^#{1,6}\s+(.+)$/gm) || [];
    headers.forEach(header => {
      const title = header.replace(/^#{1,6}\s+/, '').trim();
      if (title.length > 3 && title.length < 50) {
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('feel') || lowerTitle.includes('sound') || 
            lowerTitle.includes('force') || lowerTitle.includes('travel')) {
          characteristics.add(title);
        }
      }
    });
    
    return Array.from(characteristics).slice(0, 8);
  }

  /**
   * Extracts basic materials from markdown content
   * 
   * @param markdown - Raw markdown content
   * @returns Array of potential materials
   */
  static extractBasicMaterials(markdown: string): string[] {
    const materials: Set<string> = new Set();
    
    // Common switch materials
    const materialKeywords = [
      'polycarbonate', 'PC', 'ABS', 'POM', 'nylon', 'aluminum', 'steel',
      'brass', 'polyethylene', 'PTFE', 'PBT', 'UHMWPE', 'TPU'
    ];
    
    const lowerMarkdown = markdown.toLowerCase();
    
    for (const material of materialKeywords) {
      if (lowerMarkdown.includes(material.toLowerCase())) {
        materials.add(material);
      }
    }
    
    return Array.from(materials).slice(0, 5);
  }

  /**
   * Normalizes material name for consistency
   * 
   * @param material - Raw material name
   * @returns Normalized material name
   */
  static normalizeMaterialName(material: string): string {
    const materialMap: Record<string, string> = {
      'pc': 'PC',
      'abs': 'ABS',
      'pom': 'POM',
      'pbt': 'PBT',
      'pa': 'Nylon',
      'pa66': 'Nylon PA66',
      'uhmwpe': 'UHMWPE',
      'ptfe': 'PTFE',
      'tpu': 'TPU'
    };
    
    const lowerMaterial = material.toLowerCase().trim();
    return materialMap[lowerMaterial] || 
           material.charAt(0).toUpperCase() + material.slice(1).toLowerCase();
  }

  /**
   * Extracts section content by keywords (simplified version)
   * 
   * @param markdown - Raw markdown content
   * @param keywords - Keywords to search for
   * @returns Relevant content or fallback message
   */
  private static extractSectionContent(markdown: string, keywords: string[]): string {
    return TextProcessor.extractSectionContent(markdown, keywords);
  }
}

/**
 * Error analysis and recovery utilities
 */
export class ErrorAnalyzer {
  /**
   * Analyzes parsing error and provides recovery suggestions
   * 
   * @param error - The parsing error
   * @param markdown - Original markdown content
   * @returns Error analysis with recovery suggestions
   */
  static analyzeParsingError(error: Error, markdown: string): {
    errorType: string;
    severity: 'low' | 'medium' | 'high';
    suggestions: string[];
    hasRecoverableContent: boolean;
  } {
    const errorMessage = error.message.toLowerCase();
    const structureAnalysis = ContentAnalyzer.checkBasicMarkdownStructure(markdown);
    
    let errorType = 'UNKNOWN_ERROR';
    let severity: 'low' | 'medium' | 'high' = 'medium';
    const suggestions: string[] = [];
    
    // Classify error type
    if (errorMessage.includes('json') || errorMessage.includes('parse')) {
      errorType = 'JSON_PARSE_ERROR';
      severity = 'high';
      suggestions.push('Check for malformed JSON structures in content');
    } else if (errorMessage.includes('structure') || errorMessage.includes('format')) {
      errorType = 'STRUCTURE_ERROR';
      severity = 'medium';
      suggestions.push('Content may lack expected markdown structure');
    } else if (errorMessage.includes('timeout') || errorMessage.includes('memory')) {
      errorType = 'RESOURCE_ERROR';
      severity = 'high';
      suggestions.push('Content may be too large or complex to process');
    }
    
    // Analyze recoverability
    const hasHeaders = structureAnalysis.hasHeaders;
    const hasLists = structureAnalysis.hasLists;
    const hasTables = structureAnalysis.hasTables;
    const hasMinimalContent = markdown.length > 100;
    
    const hasRecoverableContent = hasMinimalContent && (hasHeaders || hasLists || hasTables);
    
    if (!hasRecoverableContent) {
      severity = 'high';
      suggestions.push('Content lacks sufficient structure for partial recovery');
    } else {
      suggestions.push('Partial content recovery may be possible');
    }
    
    return {
      errorType,
      severity,
      suggestions,
      hasRecoverableContent
    };
  }

  /**
   * Determines if an error should trigger retry logic
   * 
   * @param error - The error to analyze
   * @returns Whether retry is recommended
   */
  static shouldRetryAfterError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    
    // Don't retry for these error types
    const nonRetryableErrors = [
      'validation',
      'structure',
      'format',
      'empty content',
      'insufficient data'
    ];
    
    return !nonRetryableErrors.some(type => errorMessage.includes(type));
  }

  /**
   * Generates detailed error report for debugging
   * 
   * @param error - The error that occurred
   * @param markdown - Original content
   * @param responseType - Intended response type
   * @returns Detailed error report
   */
  static generateErrorReport(error: Error, markdown: string, responseType: ResponseType): {
    timestamp: Date;
    error: {
      message: string;
      type: string;
      stack?: string;
    };
    content: {
      length: number;
      structure: any;
      firstLine: string | null;
    };
    context: {
      responseType: ResponseType;
      processingStage: string;
    };
  } {
    const structureAnalysis = ContentAnalyzer.checkBasicMarkdownStructure(markdown);
    
    return {
      timestamp: new Date(),
      error: {
        message: error.message,
        type: error.constructor.name,
        stack: error.stack
      },
      content: {
        length: markdown.length,
        structure: structureAnalysis,
        firstLine: TextProcessor.extractFirstLine(markdown)
      },
      context: {
        responseType,
        processingStage: 'parsing'
      }
    };
  }
} 
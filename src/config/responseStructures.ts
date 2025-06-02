/**
 * Structured JSON Response Interfaces
 * 
 * This file contains TypeScript interfaces defining the various JSON response structures
 * for the SwitchAI chat system, replacing markdown string responses with structured data.
 * 
 * Response Types:
 * - SwitchComparisonResponse: For switch-to-switch comparisons
 * - CharacteristicsExplanationResponse: For explaining switch characteristics 
 * - MaterialAnalysisResponse: For material-focused analysis
 * - StandardRAGResponse: For general knowledge responses
 */

// =============================================================================
// SHARED SUB-STRUCTURES 
// =============================================================================

/**
 * Technical specifications for a single switch
 * Used in comparison tables and technical spec sections
 */
export interface TechnicalSpecSwitch {
  name: string;
  manufacturer: string;
  type: string | null;
  actuationForce: string | null; 
  bottomOutForce: string | null; 
  preTravel: string | null; 
  totalTravel: string | null;
  mount: string | null; 
  topHousing: string | null;
  bottomHousing: string | null;
  stem: string | null;
  spring: string | null;
  notes?: string; 
}

/**
 * Example switch with description
 * Used in characteristics and material explanations
 */
export interface ExampleSwitch {
  name: string;
  manufacturer: string;
  description: string;
  relevantCharacteristics?: string[]; 
}

/**
 * Material detail with comprehensive information
 * Used in material analysis responses
 */
export interface MaterialDetail {
  materialName: string;
  properties: {
    soundCharacteristics: string;
    feelCharacteristics: string;
    durability: string;
  };
  advantages: string[];
  disadvantages: string[];
  switchExamples: ExampleSwitch[];
}

/**
 * Characteristic detail with explanation
 * Used in characteristics explanation responses
 */
export interface CharacteristicDetail {
  characteristicName: string;
  category: 'feel' | 'sound' | 'technical' | 'build_quality' | 'other';
  explanation: string;
  factors: string[]; 
  impact: string; 
  measurementMethod?: string; 
  examples: ExampleSwitch[];
}

/**
 * Analysis section with structured content
 * Used across multiple response types for organizing analysis
 */
export interface AnalysisSection {
  title: string;
  content: string;
  keyPoints?: string[];
  subsections?: AnalysisSection[];
}

// =============================================================================
// MAIN RESPONSE INTERFACES
// =============================================================================

/**
 * Switch comparison response structure
 * Comprehensive structure for switch-to-switch comparison responses
 */
export interface SwitchComparisonResponse {
  title: string;
  switchNames: string[]; 
  
  overview: string; 
  
  technicalSpecs: {
    switches: TechnicalSpecSwitch[];
    comparisonNotes?: string; 
  };
  
  analysis: {
    feelComparison: AnalysisSection;
    soundComparison: AnalysisSection;
    buildQualityComparison: AnalysisSection;
    performanceComparison: AnalysisSection;
    materialAnalysis?: AnalysisSection; 
    useCaseAnalysis?: AnalysisSection; 
  };
  
  conclusion: {
    summary: string;
    recommendations: {
      general: string;
      byUseCase?: {
        gaming?: string;
        typing?: string;
        office?: string;
        programming?: string;
      };
    };
    keyDifferences: string[];
  };
  
  metadata: ResponseMetadata & {
    switchesCompared: number;
    allSwitchesFoundInDatabase: boolean;
    missingSwitches?: string[];
    dataQualityNotes?: string[];
  };
}

/**
 * Characteristics explanation response structure
 * Structure for explaining specific switch characteristics and properties
 */
export interface CharacteristicsExplanationResponse {
  title: string;
  characteristicsExplained: string[]; 
  
  overview: string; 
  
  characteristicDetails: CharacteristicDetail[];
  
  materialScience?: {
    title: string;
    content: string;
    technicalFactors: string[];
    physicsExplanation?: string;
  };
  
  examples: {
    title: string;
    content: string;
    switchExamples: ExampleSwitch[];
    comparativeExamples?: {
      characteristic: string;
      lowExample: ExampleSwitch;
      highExample: ExampleSwitch;
      explanation: string;
    }[];
  };
  
  practicalImplications: {
    userExperience: string;
    useCaseRecommendations: {
      gaming?: string;
      typing?: string;
      office?: string;
      programming?: string;
    };
    keyConsiderations: string[];
  };
  
  metadata: ResponseMetadata & {
    characteristicsCount: number;
    examplesProvided: number;
    technicalDepth: 'basic' | 'intermediate' | 'advanced';
  };
}

/**
 * Material analysis response structure
 * Structure for material-focused analysis and explanations
 */
export interface MaterialAnalysisResponse {
  title: string;
  materialsAnalyzed: string[];
  overview: string;
  materialDetails: MaterialDetail[];
  
  comparisons: {
    title: string;
    content: string;
    detailedAnalysis: {
      soundDifferences: string;
      feelDifferences: string;
      durabilityComparison: string;
      housingApplications: string;
      stemApplications?: string;
    };
    similarities?: string[];
    keyDistinctions: string[];
  };
  
  metadata: {
    materialsCount: number;
    examplesProvided: number;
    technicalDepth: 'basic' | 'intermediate' | 'advanced';
    analysisScope: 'single_material' | 'material_comparison' | 'comprehensive_analysis';
    sectionsFound: number;
  };
}

/**
 * Standard RAG response structure
 * Structure for general knowledge responses and standard RAG queries
 */
export interface StandardRAGResponse {
  title: string;
  queryType: 'general_knowledge' | 'product_info' | 'troubleshooting' | 'recommendation' | 'educational' | 'other';
  
  content: {
    mainAnswer: string; 
    additionalContext?: string; 
    relatedInformation?: string; 
  };
  
  sections?: AnalysisSection[];
  
  relatedSwitches?: ExampleSwitch[];
  
  keyPoints: string[];
  
  followUp?: {
    suggestedQuestions?: string[];
    relatedTopics?: string[];
    furtherReading?: {
      title: string;
      description: string;
      url?: string;
    }[];
  };
  
  sourceInformation: {
    sourceTypes: ('database' | 'general_knowledge' | 'technical_documentation' | 'community_knowledge')[];
    confidenceLevel: 'high' | 'medium' | 'low';
    lastUpdated?: Date;
    limitations?: string[];
  };
  
  metadata: ResponseMetadata & {
    responseLength: 'brief' | 'detailed' | 'comprehensive';
    technicalLevel: 'beginner' | 'intermediate' | 'advanced';
    switchesReferenced?: string[];
  };
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Union type of all possible structured response data
 */
export type StructuredResponseData = 
  | SwitchComparisonResponse 
  | CharacteristicsExplanationResponse 
  | MaterialAnalysisResponse 
  | StandardRAGResponse;

/**
 * Response type discriminators
 */
export type ResponseType = 'switch_comparison' | 'characteristics_explanation' | 'material_analysis' | 'standard_rag';

/**
 * Common metadata for all response types
 */
export interface ResponseMetadata {
  confidence?: number;
  sources?: string[];
  generationTime?: number; 
  warnings?: string[];
  limitations?: string[];
} 
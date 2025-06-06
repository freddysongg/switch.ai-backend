/**
 * Response Structure Configuration for LLM-Powered Switch Analysis
 *
 * This file defines the comprehensive "word bank" of potential JSON fields
 * that the LLM can use to structure its responses. Most fields are optional
 * and the LLM will populate only those relevant to the specific query.
 *
 * The "overview" field is mandatory for all successful responses (FR4.4).
 */

// Technical specifications for a single switch
export interface SwitchSpecifications {
  switchName?: string;
  manufacturer?: string;
  type?: string; // Linear, Tactile, Clicky
  topHousing?: string; // Material
  bottomHousing?: string; // Material
  stem?: string; // Material
  mount?: string; // Type (e.g., 3-pin, 5-pin)
  spring?: string; // Details about spring
  actuationForceG?: number;
  bottomOutForceG?: number;
  preTravelMm?: number;
  totalTravelMm?: number;
  factoryLubed?: string; // "Yes" | "No" | "Partial" | "Unknown"
  additionalNotes?: string;
}

// Comprehensive analysis sections for comparison queries
export interface ComparisonAnalysis {
  feelingTactility?: string;
  soundProfile?: string;
  buildMaterialComposition?: string;
  performanceAspects?: string;
}

// Material analysis sections
export interface MaterialAnalysis {
  materialComposition?: string;
  propertiesExplanation?: string;
  switchApplications?: string;
  soundImpact?: string;
  feelImpact?: string;
  performanceImpact?: string;
}

// Example switch data for material comparisons
export interface ExampleSwitch {
  switchName?: string;
  briefOverview?: string;
  specifications?: SwitchSpecifications;
  soundProfile?: string;
  relevanceToMaterial?: string;
}

// Individual switch data for comparison responses
export interface ComparisonSwitchData {
  switchName?: string;
  specifications?: SwitchSpecifications;
  individualAnalysis?: string;
  recommendations?: string[];
}

// Root response structure - the main "word bank" of all possible fields
export interface AnalysisResponse {
  // MANDATORY FIELD - Must be present in all successful responses (FR4.4)
  overview: string;

  // General single switch query fields (FR3.3)
  technicalSpecifications?: SwitchSpecifications;
  soundProfile?: string;
  typingFeel?: string;
  typingExperience?: string;
  recommendations?: string[];

  // Follow-up query fields (FR3.4)
  contextualConnection?: string;
  specificApplication?: string;
  implication?: string;

  // Switch comparison query fields (FR3.5)
  comparedSwitches?: {
    [switchName: string]: ComparisonSwitchData;
  };
  comparativeAnalysis?: {
    feelingTactility?:
      | {
          description?: string;
          keyDifferences?: string;
          userImpact?: string;
        }
      | string; // Support both detailed object and simple string
    soundProfile?:
      | {
          description?: string;
          acousticDifferences?: string;
          environmentalConsiderations?: string;
        }
      | string;
    buildMaterialComposition?:
      | {
          materialComparison?: string;
          durabilityAssessment?: string;
          modificationPotential?: string;
        }
      | string;
    performanceAspects?:
      | {
          gamingPerformance?: string;
          typingPerformance?: string;
          consistencyReliability?: string;
          fatigueFactors?: string;
        }
      | string;
  };
  conclusion?:
    | {
        primaryDifferences?: string;
        overallAssessment?: string;
        decisionGuidance?: string;
      }
    | string; // Support both detailed object and simple string
  switchRecommendations?: {
    [switchName: string]: string[];
  };

  // Material comparison query fields (FR3.6)
  materialAnalysis?: MaterialAnalysis;
  materialCombinationEffects?: string;
  exampleSwitches?: ExampleSwitch[];

  // Advanced analysis fields
  housingMaterials?: string;
  forceWeighting?: string;
  travelActuation?: string;
  useCaseSuitability?: string;

  // Build and performance analysis
  buildQuality?: string;
  durability?: string;
  modifiability?: string;
  compatibility?: string;

  // Professional analysis fields
  frequencyResponse?: string;
  acousticProperties?: string;
  tactileCharacteristics?: string;
  ergonomicConsiderations?: string;
  manufacturingQuality?: string;

  // General analysis fields
  analysis?: string;

  // Meta fields
  analysisConfidence?: string;
  dataSource?: string; // "Database" | "LLM Knowledge" | "Mixed"
  additionalNotes?: string;

  // Legacy fields for backward compatibility
  specifications?: any;
  feelAndExperience?: any;
  comparison?: any;

  // Error handling and conflict resolution (FR6.1, FR2.4)
  error?: AnalysisError;
  dataConflictResolution?: {
    conflictsFound: number;
    resolutionStrategy: string;
    conflicts: Array<{
      switchName: string;
      conflicts: Array<{
        field: string;
        databaseValue: any;
        llmValue: any;
        resolution: 'database' | 'llm' | 'both';
        reason: string;
      }>;
    }>;
    note: string;
  };
}

// Analysis error interface for error handling
export interface AnalysisError {
  code:
    | 'INVALID_QUERY'
    | 'INTENT_RECOGNITION_FAILED'
    | 'DATABASE_ERROR'
    | 'LLM_REQUEST_FAILED'
    | 'LLM_RESPONSE_INVALID'
    | 'RESPONSE_VALIDATION_FAILED'
    | 'TIMEOUT'
    | 'RATE_LIMITED'
    | 'INTERNAL_ERROR'
    | 'NETWORK_ERROR'
    | 'AUTHENTICATION_ERROR'
    | 'QUOTA_EXCEEDED';
  message: string;
  step?: string;
  details?: any;
  recoverable: boolean;
  timestamp?: Date;
  retryDelay?: number;
}

// Type for communicating the structure to the LLM
export interface LLMPromptStructure {
  description: string;
  mandatoryFields: string[];
  optionalFieldCategories: {
    [category: string]: string[];
  };
}

/**
 * Simplified structure description for LLM prompting
 * This will be used to communicate the expected structure to the LLM
 */
export const LLM_RESPONSE_STRUCTURE: LLMPromptStructure = {
  description:
    'Flexible JSON response structure where most fields are optional. Populate only fields relevant to the specific query type and content.',
  mandatoryFields: [
    'overview' // Must always be present and comprehensive
  ],
  optionalFieldCategories: {
    'Single Switch Analysis': [
      'technicalSpecifications',
      'soundProfile',
      'typingFeel',
      'typingExperience',
      'recommendations'
    ],
    'Follow-up Queries': ['contextualConnection', 'specificApplication', 'implication'],
    'Switch Comparisons': [
      'comparedSwitches',
      'comparativeAnalysis',
      'conclusion',
      'switchRecommendations'
    ],
    'Material Analysis': ['materialAnalysis', 'materialCombinationEffects', 'exampleSwitches'],
    'Advanced Analysis': [
      'housingMaterials',
      'forceWeighting',
      'travelActuation',
      'useCaseSuitability',
      'buildQuality',
      'durability',
      'modifiability',
      'compatibility'
    ],
    'Professional Fields': [
      'frequencyResponse',
      'acousticProperties',
      'tactileCharacteristics',
      'ergonomicConsiderations',
      'manufacturingQuality'
    ],
    'Meta Information': ['analysisConfidence', 'dataSource', 'additionalNotes']
  }
};

/**
 * Utility function to get a JSON schema-like description for the LLM
 */
export function getStructureDescription(): string {
  return `
JSON Response Structure Guide:

MANDATORY FIELD:
- overview: (string) Comprehensive summary and introduction - ALWAYS required

OPTIONAL FIELDS (use only what's relevant to the query):

Single Switch Analysis:
- technicalSpecifications: (object) Switch specs including forces, materials, travel
- soundProfile: (string) Sound characteristics analysis  
- typingFeel: (string) Feel and tactility description
- typingExperience: (string) Overall typing experience
- recommendations: (array) Recommended similar switches

Switch Comparisons:
- comparedSwitches: (object) Nested data for each switch with specs and analysis
- comparativeAnalysis: (object) Direct comparisons of feel, sound, build, performance
- conclusion: (string) Summary of key differences
- switchRecommendations: (object) Individual recommendations per switch

Material Analysis:
- materialAnalysis: (object) Material properties and applications
- materialCombinationEffects: (string) How combinations affect performance
- exampleSwitches: (array) Example switches using these materials

Advanced Fields:
- housingMaterials, forceWeighting, travelActuation, useCaseSuitability, buildQuality, etc.

Meta Fields:
- analysisConfidence, dataSource, additionalNotes

Populate only relevant fields based on the query type and your analysis.
`;
}

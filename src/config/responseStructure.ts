/**
 * Response Structure Configuration for LLM-Powered Switch Analysis
 *
 * This file defines the comprehensive "word bank" of potential JSON fields
 * that the LLM can use to structure its responses. Most fields are optional
 * and the LLM will populate only those relevant to the specific query.
 *
 * The "overview" field is mandatory for all successful responses (FR4.4).
 */

interface SwitchSpecifications {
  switchName?: string;
  manufacturer?: string;
  type?: string;
  topHousing?: string;
  bottomHousing?: string;
  stem?: string;
  mount?: string;
  spring?: string;
  actuationForceG?: number;
  bottomOutForceG?: number;
  preTravelMm?: number;
  totalTravelMm?: number;
  factoryLubed?: string;
  additionalNotes?: string;
}

interface MaterialAnalysis {
  materialComposition?: string;
  propertiesExplanation?: string;
  switchApplications?: string;
  soundImpact?: string;
  feelImpact?: string;
  performanceImpact?: string;
}

interface ExampleSwitch {
  switchName?: string;
  briefOverview?: string;
  specifications?: SwitchSpecifications;
  soundProfile?: string;
  relevanceToMaterial?: string;
}

interface ComparisonSwitchData {
  switchName?: string;
  specifications?: SwitchSpecifications;
  individualAnalysis?: string;
  recommendations?: string[];
}

export interface AnalysisResponse {
  overview: string;

  technicalSpecifications?: SwitchSpecifications;
  soundProfile?: string;
  typingFeel?: string;
  typingExperience?: string;
  recommendations?: string[];

  contextualConnection?: string;
  specificApplication?: string;
  implication?: string;

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
      | string;
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
    | string;
  switchRecommendations?: {
    [switchName: string]: string[];
  };

  materialAnalysis?: MaterialAnalysis;
  materialCombinationEffects?: string;
  exampleSwitches?: ExampleSwitch[];

  housingMaterials?: string;
  forceWeighting?: string;
  travelActuation?: string;
  useCaseSuitability?: string;

  buildQuality?: string;
  durability?: string;
  modifiability?: string;
  compatibility?: string;

  frequencyResponse?: string;
  acousticProperties?: string;
  tactileCharacteristics?: string;
  ergonomicConsiderations?: string;
  manufacturingQuality?: string;

  analysis?: string;

  analysisConfidence?: string;
  dataSource?: string;
  additionalNotes?: string;

  specifications?: any;
  feelAndExperience?: any;
  comparison?: any;

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

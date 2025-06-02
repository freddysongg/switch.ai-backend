import { SwitchResolutionResult } from '../services/switchResolution.js';

/**
 * Represents comparison intent analysis results
 * Used to determine if a user query is requesting a switch comparison
 */
export interface ComparisonIntent {
  isComparison: boolean;
  confidence: number;
  extractedSwitchNames: string[];
  originalQuery: string;
}

/**
 * Context information about a switch for prompt building
 * Contains minimal data needed for generating comparison responses
 */
export interface SwitchContextForPrompt {
  name: string;
  manufacturer: string;
  type: string | null;
  spring: string | null;
  actuationForce: number | null;
  description_text?: string;
}

/**
 * Individual switch data retrieval result
 * Tracks whether switch was found and includes complete switch information
 */
export interface SwitchDataRetrievalResult {
  name: string;
  isFound: boolean;
  switchData?: {
    id: string;
    name: string;
    manufacturer: string;
    type: string | null;
    description: string | null;
    image: string | null;
    releaseYear: number | null;
    actuationForce: number | null;
    bottomOutForce: number | null;
    preTravelDistance: number | null;
    totalTravelDistance: number | null;
    springLength: number | null;
    factoryLubed: boolean | null;
    mountType: string | null;
    rgb: boolean | null;
    hotSwappable: boolean | null;
    topHousing: string | null;
    bottomHousing: string | null;
    stem: string | null;
    spring: string | null;
    mount: string | null;
    sound: string | null;
    tags: string | null;
    availability: string | null;
    price: number | null;
    link: string | null;
  };
  error?: string;
}

export interface MaterialContext {
  materialType: 'housing' | 'stem' | 'spring';
  materialName: string;
  soundCharacteristics: string;
  feelCharacteristics: string;
  enthusiastTerminology: string;
  usageImplications: string;
}

export interface SwitchMaterialProperties {
  topHousing: string | null;
  bottomHousing: string | null;
  stem: string | null;
  spring: string | null;
  actuationForce: number | null;
  bottomForce: number | null;
}

export interface EnhancedSwitchContext {
  switchName: string;
  databaseData: ComprehensiveSwitchData;
  materialProperties: SwitchMaterialProperties;
  materialContext: MaterialContext[];
  soundProfile: string;
  feelProfile: string;
  useCaseRecommendations: string;
  enthusiastSummary: string;
}

export interface ComparisonResolutionMetadata {
  originalQuery: string;
  resolutionMethod: 'exact' | 'fuzzy' | 'embedding' | 'ai_disambiguation' | 'ai_general_knowledge';
  resolutionConfidence: number;
  switchesResolved: ResolvedSwitchInfo[];
  warnings: string[];
  processingNotes: string[];
}

export interface ResolvedSwitchInfo {
  queryFragment: string;
  resolvedName: string;
  confidence: number;
  databaseMatch: boolean;
  brandCompleted: boolean;
  inferredBrand?: string;
  inferredType?: string;
  ambiguityResolved?: boolean;
}

export interface EnhancedComparisonRequest {
  userQuery: string;
  detectedSwitches: string[];
  resolutionMetadata: ComparisonResolutionMetadata;
  materialContextEnabled: boolean;
  useCaseDetected?: string;
  confidence: number;
}

export interface EnhancedComparisonResponse {
  switchContexts: EnhancedSwitchContext[];
  materialComparison: MaterialComparisonSummary;
  useCaseAnalysis?: UseCaseAnalysis;
  overallRecommendation: string;
  metadata: ComparisonResponseMetadata;
}

export interface MaterialComparisonSummary {
  housingMaterialsComparison: string;
  stemMaterialsComparison: string;
  springWeightComparison: string;
  soundProfileComparison: string;
  feelProfileComparison: string;
  enthusiastTerminologyUsed: string[];
}

export interface UseCaseAnalysis {
  detectedUseCase: 'gaming' | 'typing' | 'office' | 'programming';
  useCaseSpecificRecommendations: string;
  environmentalConsiderations: string;
  performanceImplications: string;
}

export interface ComparisonResponseMetadata {
  switchesCompared: number;
  materialContextApplied: boolean;
  useCaseDetected: boolean;
  resolutionMethod: string;
  promptLength: number;
  responseGenerated: Date;
  confidenceScore: number;
}

export interface ComprehensiveSwitchData {
  name: string;
  manufacturer: string;
  type: string | null;
  topHousing: string | null;
  bottomHousing: string | null;
  stem: string | null;
  mount: string | null;
  spring: string | null;
  actuationForce: number | null;
  bottomForce: number | null;
  preTravel: number | null;
  totalTravel: number | null;
  isFound: boolean;
  missingFields: string[];
  matchConfidence?: number;
  originalQuery: string;
}

export interface EnhancedComparisonConfig {
  resolutionThresholds: {
    exactMatch: number;
    fuzzyMatch: number;
    embeddingMatch: number;
    aiDisambiguation: number;
  };
  materialContextSettings: {
    enableSoundDescriptors: boolean;
    enableFeelDescriptors: boolean;
    enableUseCaseDetection: boolean;
    enableEnthusiastTerminology: boolean;
  };
  promptEnhancementSettings: {
    materialContextInjection: boolean;
    useCaseContextInjection: boolean;
    enhancedLanguageInstructions: boolean;
    attributionTemplatesEnabled: boolean;
  };
}

export interface ComparisonWarning {
  type: 'low_confidence' | 'missing_data' | 'resolution_fallback' | 'material_context_unavailable';
  message: string;
  affectedSwitch?: string;
  confidence?: number;
}

export interface ComparisonError {
  type: 'resolution_failed' | 'database_error' | 'prompt_building_failed' | 'ai_generation_failed';
  message: string;
  details?: string;
  recoverable: boolean;
}

export interface ComparisonAnalyticsEvent {
  eventType:
    | 'comparison_initiated'
    | 'resolution_completed'
    | 'material_context_applied'
    | 'comparison_generated';
  timestamp: Date;
  userQuery: string;
  resolutionMethod?: string;
  switchesInvolved: string[];
  confidence: number;
  materialContextApplied: boolean;
  useCaseDetected?: string;
  warnings: ComparisonWarning[];
  errors: ComparisonError[];
}

export interface SwitchContextForPrompt {
  [key: string]: unknown;
  name: string;
  manufacturer: string;
  type: string | null;
  spring: string | null;
  actuationForce: number | null;
  description_text?: string;
  similarity?: number;
}

export interface ComparisonIntent {
  isComparison: boolean;
  confidence: number;
  extractedSwitchNames: string[];
  originalQuery: string;
}

export interface ProcessedComparisonRequest {
  isValidComparison: boolean;
  switchesToCompare: string[];
  userFeedbackMessage?: string;
  confidence: number;
  originalQuery: string;
  processingNote?: string;
  resolutionResult?: SwitchResolutionResult;
  isCharacteristicsExplanation?: boolean;
  characteristicsExamples?: Record<string, SwitchCandidate[]>;
  isMaterialsExplanation?: boolean;
  materialsToExplain?: string[];
  materialExamples?: Record<string, any[]>;
}

export interface ComprehensiveSwitchData {
  name: string;
  manufacturer: string;
  type: string | null;
  topHousing: string | null;
  bottomHousing: string | null;
  stem: string | null;
  mount: string | null;
  spring: string | null;
  actuationForce: number | null;
  bottomForce: number | null;
  preTravel: number | null;
  totalTravel: number | null;
  isFound: boolean;
  missingFields: string[];
  matchConfidence?: number;
  originalQuery: string;
}

export interface ComparisonDataRetrievalResult {
  switchesData: ComprehensiveSwitchData[];
  allSwitchesFound: boolean;
  missingSwitches: string[];
  hasDataGaps: boolean;
  retrievalNotes: string[];
}

export interface SwitchCandidate {
  name: string;
  manufacturer: string;
  type: string;
  actuationForce: number | null;
  description: string;
}

export interface CharacteristicsAnalysisResult {
  selectedSwitches: string[];
  analysis: string;
}

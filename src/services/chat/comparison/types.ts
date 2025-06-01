import { SwitchResolutionResult } from '../../switchResolution.js';

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

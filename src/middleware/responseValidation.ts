import { Request, Response, NextFunction } from 'express';
import { StructuredContent } from '../types/chat.js';
import {
  SwitchComparisonResponse,
  CharacteristicsExplanationResponse,
  MaterialAnalysisResponse,
  StandardRAGResponse,
  ResponseType
} from '../config/responseStructures.js';

/**
 * Validation error types for structured responses
 */
export enum ValidationErrorType {
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_TYPE = 'INVALID_FIELD_TYPE',
  INVALID_FIELD_VALUE = 'INVALID_FIELD_VALUE',
  EMPTY_REQUIRED_ARRAY = 'EMPTY_REQUIRED_ARRAY',
  INVALID_RESPONSE_TYPE = 'INVALID_RESPONSE_TYPE',
  MALFORMED_STRUCTURE = 'MALFORMED_STRUCTURE',
  VALIDATION_FAILED = 'VALIDATION_FAILED'
}

/**
 * Validation error details
 */
export interface ValidationError {
  type: ValidationErrorType;
  field: string;
  message: string;
  expectedType?: string;
  actualType?: string;
  value?: any;
}

/**
 * Validation result with details
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  metadata: {
    validatedAt: Date;
    responseType: ResponseType;
    dataSize: number;
    validationTime: number;
  };
}

/**
 * Response validation middleware for structured JSON responses
 * Validates data integrity, completeness, and format compliance
 */
export class ResponseValidationMiddleware {
  private readonly enableStrictValidation: boolean;
  private readonly logValidationErrors: boolean;

  constructor(options: {
    enableStrictValidation?: boolean;
    logValidationErrors?: boolean;
  } = {}) {
    this.enableStrictValidation = options.enableStrictValidation ?? true;
    this.logValidationErrors = options.logValidationErrors ?? true;
  }

  /**
   * Express middleware function for response validation
   */
  public validateResponse = () => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const originalSend = res.send;
      const startTime = Date.now();
      const middlewareInstance = this;

      res.send = function(this: Response, body: any): Response {
        try {
          if (ResponseValidationMiddleware.isStructuredContent(body)) {
            const validationResult = ResponseValidationMiddleware.validateStructuredContent(body);
            
            if (!validationResult.isValid && middlewareInstance.enableStrictValidation) {
              console.error('❌ Response validation failed:', validationResult.errors);
              
              const errorResponse = {
                error: 'Response validation failed',
                details: validationResult.errors,
                timestamp: new Date().toISOString()
              };
              
              return originalSend.call(this, errorResponse);
            }

            if (middlewareInstance.logValidationErrors && validationResult.errors.length > 0) {
              console.warn('⚠️ Response validation warnings:', validationResult.errors);
            }

            this.setHeader('X-Response-Validated', 'true');
            this.setHeader('X-Validation-Time', `${Date.now() - startTime}ms`);
            this.setHeader('X-Validation-Errors', validationResult.errors.length.toString());
            this.setHeader('X-Validation-Warnings', validationResult.warnings.length.toString());
          }

          return originalSend.call(this, body);
        } catch (error) {
          console.error('❌ Response validation middleware error:', error);
          return originalSend.call(this, body);
        }
      };

      next();
    };
  };

  /**
   * Check if response body is structured content
   */
  public static isStructuredContent(body: any): body is StructuredContent {
    return (
      body &&
      typeof body === 'object' &&
      typeof body.responseType === 'string' &&
      body.data &&
      typeof body.data === 'object' &&
      typeof body.version === 'string' &&
      body.generatedAt
    );
  }

  /**
   * Validate structured content response
   */
  public static validateStructuredContent(content: StructuredContent): ValidationResult {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    try {
      // Validate base structure
      const baseValidation = this.validateBaseStructure(content);
      errors.push(...baseValidation.errors);
      warnings.push(...baseValidation.warnings);

      // Validate response type specific data
      const dataValidation = this.validateResponseTypeData(content.responseType, content.data);
      errors.push(...dataValidation.errors);
      warnings.push(...dataValidation.warnings);

      // Validate metadata if present
      if (content.metadata) {
        const metadataValidation = this.validateMetadata(content.metadata);
        errors.push(...metadataValidation.errors);
        warnings.push(...metadataValidation.warnings);
      }

      const validationTime = Date.now() - startTime;

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        metadata: {
          validatedAt: new Date(),
          responseType: content.responseType,
          dataSize: JSON.stringify(content).length,
          validationTime
        }
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [{
          type: ValidationErrorType.VALIDATION_FAILED,
          field: 'unknown',
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        warnings,
        metadata: {
          validatedAt: new Date(),
          responseType: content.responseType || 'unknown' as ResponseType,
          dataSize: 0,
          validationTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Validate base StructuredContent structure
   */
  private static validateBaseStructure(content: StructuredContent): {
    errors: ValidationError[];
    warnings: string[];
  } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Validate responseType
    if (!content.responseType) {
      errors.push({
        type: ValidationErrorType.MISSING_REQUIRED_FIELD,
        field: 'responseType',
        message: 'responseType is required'
      });
    } else {
      const validTypes: ResponseType[] = ['switch_comparison', 'characteristics_explanation', 'material_analysis', 'standard_rag'];
      if (!validTypes.includes(content.responseType)) {
        errors.push({
          type: ValidationErrorType.INVALID_FIELD_VALUE,
          field: 'responseType',
          message: `Invalid responseType: ${content.responseType}`,
          value: content.responseType
        });
      }
    }

    // Validate data
    if (!content.data) {
      errors.push({
        type: ValidationErrorType.MISSING_REQUIRED_FIELD,
        field: 'data',
        message: 'data is required'
      });
    } else if (typeof content.data !== 'object') {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'data',
        message: 'data must be an object',
        expectedType: 'object',
        actualType: typeof content.data
      });
    }

    // Validate version
    if (!content.version) {
      errors.push({
        type: ValidationErrorType.MISSING_REQUIRED_FIELD,
        field: 'version',
        message: 'version is required'
      });
    } else if (typeof content.version !== 'string') {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'version',
        message: 'version must be a string',
        expectedType: 'string',
        actualType: typeof content.version
      });
    } else if (!content.version.match(/^\d+\.\d+\.\d+$/)) {
      warnings.push('version should follow semantic versioning format (e.g., 1.0.0)');
    }

    // Validate generatedAt
    if (!content.generatedAt) {
      errors.push({
        type: ValidationErrorType.MISSING_REQUIRED_FIELD,
        field: 'generatedAt',
        message: 'generatedAt is required'
      });
    } else {
      const date = new Date(content.generatedAt);
      if (isNaN(date.getTime())) {
        errors.push({
          type: ValidationErrorType.INVALID_FIELD_VALUE,
          field: 'generatedAt',
          message: 'generatedAt must be a valid date',
          value: content.generatedAt
        });
      } else {
        const now = new Date();
        if (date.getTime() > now.getTime() + 60000) {
          warnings.push('generatedAt timestamp is in the future');
        }
        if (date.getTime() < now.getTime() - 86400000) {
          warnings.push('generatedAt timestamp is more than 1 day old');
        }
      }
    }

    // Validate error field if present
    if (content.error) {
      const errorValidation = this.validateErrorField(content.error);
      errors.push(...errorValidation.errors);
      warnings.push(...errorValidation.warnings);
    }

    // Validate isFallback flag
    if (content.isFallback !== undefined && typeof content.isFallback !== 'boolean') {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'isFallback',
        message: 'isFallback must be a boolean',
        expectedType: 'boolean',
        actualType: typeof content.isFallback
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate response type specific data
   */
  private static validateResponseTypeData(responseType: ResponseType, data: any): {
    errors: ValidationError[];
    warnings: string[];
  } {
    switch (responseType) {
      case 'switch_comparison':
        return this.validateSwitchComparisonData(data);
      case 'characteristics_explanation':
        return this.validateCharacteristicsExplanationData(data);
      case 'material_analysis':
        return this.validateMaterialAnalysisData(data);
      case 'standard_rag':
        return this.validateStandardRAGData(data);
      default:
        return {
          errors: [{
            type: ValidationErrorType.INVALID_RESPONSE_TYPE,
            field: 'responseType',
            message: `Unknown response type: ${responseType}`,
            value: responseType
          }],
          warnings: []
        };
    }
  }

  /**
   * Validate switch comparison response data
   */
  private static validateSwitchComparisonData(data: SwitchComparisonResponse): {
    errors: ValidationError[];
    warnings: string[];
  } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Required string fields
    const requiredStringFields = ['title', 'overview'];
    for (const field of requiredStringFields) {
      if (!data[field as keyof SwitchComparisonResponse]) {
        errors.push({
          type: ValidationErrorType.MISSING_REQUIRED_FIELD,
          field,
          message: `${field} is required`
        });
      } else if (typeof data[field as keyof SwitchComparisonResponse] !== 'string') {
        errors.push({
          type: ValidationErrorType.INVALID_FIELD_TYPE,
          field,
          message: `${field} must be a string`,
          expectedType: 'string',
          actualType: typeof data[field as keyof SwitchComparisonResponse]
        });
      }
    }

    // Validate switchNames array
    if (!data.switchNames) {
      errors.push({
        type: ValidationErrorType.MISSING_REQUIRED_FIELD,
        field: 'switchNames',
        message: 'switchNames is required'
      });
    } else if (!Array.isArray(data.switchNames)) {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'switchNames',
        message: 'switchNames must be an array',
        expectedType: 'array',
        actualType: typeof data.switchNames
      });
    } else {
      if (data.switchNames.length === 0) {
        warnings.push('switchNames array is empty');
      }
      // Validate each switch name
      data.switchNames.forEach((name, index) => {
        if (typeof name !== 'string') {
          errors.push({
            type: ValidationErrorType.INVALID_FIELD_TYPE,
            field: `switchNames[${index}]`,
            message: 'Each switch name must be a string',
            expectedType: 'string',
            actualType: typeof name
          });
        } else if (name.trim().length === 0) {
          errors.push({
            type: ValidationErrorType.INVALID_FIELD_VALUE,
            field: `switchNames[${index}]`,
            message: 'Switch name cannot be empty',
            value: name
          });
        }
      });
    }

    // Validate technicalSpecs
    if (!data.technicalSpecs) {
      errors.push({
        type: ValidationErrorType.MISSING_REQUIRED_FIELD,
        field: 'technicalSpecs',
        message: 'technicalSpecs is required'
      });
    } else {
      if (!data.technicalSpecs.switches || !Array.isArray(data.technicalSpecs.switches)) {
        errors.push({
          type: ValidationErrorType.INVALID_FIELD_TYPE,
          field: 'technicalSpecs.switches',
          message: 'technicalSpecs.switches must be an array',
          expectedType: 'array',
          actualType: typeof data.technicalSpecs.switches
        });
      } else if (data.technicalSpecs.switches.length === 0) {
        warnings.push('technicalSpecs.switches array is empty');
      }
    }

    // Validate analysis structure
    const analysisValidation = this.validateAnalysisStructure(data.analysis);
    errors.push(...analysisValidation.errors);
    warnings.push(...analysisValidation.warnings);

    // Validate conclusion structure
    const conclusionValidation = this.validateConclusionStructure(data.conclusion);
    errors.push(...conclusionValidation.errors);
    warnings.push(...conclusionValidation.warnings);

    // Validate metadata
    const metadataValidation = this.validateSwitchComparisonMetadata(data.metadata);
    errors.push(...metadataValidation.errors);
    warnings.push(...metadataValidation.warnings);

    return { errors, warnings };
  }

  /**
   * Validate characteristics explanation response data
   */
  private static validateCharacteristicsExplanationData(data: CharacteristicsExplanationResponse): {
    errors: ValidationError[];
    warnings: string[];
  } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Required string fields
    const requiredStringFields = ['title', 'overview'];
    for (const field of requiredStringFields) {
      if (!data[field as keyof CharacteristicsExplanationResponse]) {
        errors.push({
          type: ValidationErrorType.MISSING_REQUIRED_FIELD,
          field,
          message: `${field} is required`
        });
      }
    }

    // Validate characteristicsExplained array
    if (!data.characteristicsExplained || !Array.isArray(data.characteristicsExplained)) {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'characteristicsExplained',
        message: 'characteristicsExplained must be an array',
        expectedType: 'array',
        actualType: typeof data.characteristicsExplained
      });
    } else if (data.characteristicsExplained.length === 0) {
      warnings.push('characteristicsExplained array is empty');
    }

    // Validate characteristicDetails array
    if (!data.characteristicDetails || !Array.isArray(data.characteristicDetails)) {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'characteristicDetails',
        message: 'characteristicDetails must be an array',
        expectedType: 'array',
        actualType: typeof data.characteristicDetails
      });
    }

    // Validate examples structure
    if (!data.examples || typeof data.examples !== 'object') {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'examples',
        message: 'examples must be an object',
        expectedType: 'object',
        actualType: typeof data.examples
      });
    } else {
      if (!data.examples.title || !data.examples.content) {
        errors.push({
          type: ValidationErrorType.MISSING_REQUIRED_FIELD,
          field: 'examples',
          message: 'examples must have title and content fields'
        });
      }
    }

    // Validate practicalImplications structure
    if (!data.practicalImplications || typeof data.practicalImplications !== 'object') {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'practicalImplications',
        message: 'practicalImplications must be an object',
        expectedType: 'object',
        actualType: typeof data.practicalImplications
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate material analysis response data
   */
  private static validateMaterialAnalysisData(data: MaterialAnalysisResponse): {
    errors: ValidationError[];
    warnings: string[];
  } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Required string fields
    const requiredStringFields = ['title', 'overview'];
    for (const field of requiredStringFields) {
      if (!data[field as keyof MaterialAnalysisResponse]) {
        errors.push({
          type: ValidationErrorType.MISSING_REQUIRED_FIELD,
          field,
          message: `${field} is required`
        });
      }
    }

    // Validate materialsAnalyzed array
    if (!data.materialsAnalyzed || !Array.isArray(data.materialsAnalyzed)) {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'materialsAnalyzed',
        message: 'materialsAnalyzed must be an array',
        expectedType: 'array',
        actualType: typeof data.materialsAnalyzed
      });
    } else if (data.materialsAnalyzed.length === 0) {
      warnings.push('materialsAnalyzed array is empty');
    }

    // Validate material analysis structure
    if (!data.materialDetails || !Array.isArray(data.materialDetails)) {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'materialDetails',
        message: 'Material details must be an array',
        expectedType: 'array',
        actualType: typeof data.materialDetails
      });
    }

    // Validate comparisons section structure
    if (!data.comparisons || typeof data.comparisons !== 'object') {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'comparisons',
        message: 'Comparisons section is required for material analysis',
        expectedType: 'object',
        actualType: typeof data.comparisons
      });
    }

    if (data.comparisons && (!data.comparisons.detailedAnalysis || typeof data.comparisons.detailedAnalysis !== 'object')) {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'comparisons.detailedAnalysis',
        message: 'Detailed analysis is required in comparisons',
        expectedType: 'object',
        actualType: typeof data.comparisons.detailedAnalysis
      });
    }

    // Validate metadata
    if (!data.metadata || typeof data.metadata !== 'object') {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'metadata',
        message: 'Metadata is required for material analysis',
        expectedType: 'object',
        actualType: typeof data.metadata
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate standard RAG response data
   */
  private static validateStandardRAGData(data: StandardRAGResponse): {
    errors: ValidationError[];
    warnings: string[];
  } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Required string fields
    const requiredStringFields = ['title'];
    for (const field of requiredStringFields) {
      if (!data[field as keyof StandardRAGResponse]) {
        errors.push({
          type: ValidationErrorType.MISSING_REQUIRED_FIELD,
          field,
          message: `${field} is required`
        });
      }
    }

    // Validate queryType
    if (!data.queryType) {
      errors.push({
        type: ValidationErrorType.MISSING_REQUIRED_FIELD,
        field: 'queryType',
        message: 'queryType is required'
      });
    } else {
      const validQueryTypes = ['general_knowledge', 'product_info', 'troubleshooting', 'recommendation', 'educational', 'other'];
      if (!validQueryTypes.includes(data.queryType)) {
        errors.push({
          type: ValidationErrorType.INVALID_FIELD_VALUE,
          field: 'queryType',
          message: `Invalid queryType: ${data.queryType}`,
          value: data.queryType
        });
      }
    }

    // Validate content structure
    if (!data.content || typeof data.content !== 'object') {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'content',
        message: 'content must be an object',
        expectedType: 'object',
        actualType: typeof data.content
      });
    } else {
      if (!data.content.mainAnswer) {
        errors.push({
          type: ValidationErrorType.MISSING_REQUIRED_FIELD,
          field: 'content.mainAnswer',
          message: 'content.mainAnswer is required'
        });
      }
    }

    // Validate keyPoints array
    if (!data.keyPoints || !Array.isArray(data.keyPoints)) {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'keyPoints',
        message: 'keyPoints must be an array',
        expectedType: 'array',
        actualType: typeof data.keyPoints
      });
    }

    // Validate sourceInformation
    if (!data.sourceInformation || typeof data.sourceInformation !== 'object') {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'sourceInformation',
        message: 'sourceInformation must be an object',
        expectedType: 'object',
        actualType: typeof data.sourceInformation
      });
    } else {
      if (!data.sourceInformation.sourceTypes || !Array.isArray(data.sourceInformation.sourceTypes)) {
        errors.push({
          type: ValidationErrorType.INVALID_FIELD_TYPE,
          field: 'sourceInformation.sourceTypes',
          message: 'sourceInformation.sourceTypes must be an array',
          expectedType: 'array',
          actualType: typeof data.sourceInformation.sourceTypes
        });
      }

      if (!data.sourceInformation.confidenceLevel) {
        errors.push({
          type: ValidationErrorType.MISSING_REQUIRED_FIELD,
          field: 'sourceInformation.confidenceLevel',
          message: 'sourceInformation.confidenceLevel is required'
        });
      } else {
        const validConfidenceLevels = ['high', 'medium', 'low'];
        if (!validConfidenceLevels.includes(data.sourceInformation.confidenceLevel)) {
          errors.push({
            type: ValidationErrorType.INVALID_FIELD_VALUE,
            field: 'sourceInformation.confidenceLevel',
            message: `Invalid confidenceLevel: ${data.sourceInformation.confidenceLevel}`,
            value: data.sourceInformation.confidenceLevel
          });
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate analysis structure
   */
  private static validateAnalysisStructure(analysis: any): {
    errors: ValidationError[];
    warnings: string[];
  } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!analysis || typeof analysis !== 'object') {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'analysis',
        message: 'analysis must be an object',
        expectedType: 'object',
        actualType: typeof analysis
      });
      return { errors, warnings };
    }

    const requiredSections = ['feelComparison', 'soundComparison', 'buildQualityComparison', 'performanceComparison'];
    for (const section of requiredSections) {
      if (!analysis[section]) {
        errors.push({
          type: ValidationErrorType.MISSING_REQUIRED_FIELD,
          field: `analysis.${section}`,
          message: `analysis.${section} is required`
        });
      } else if (!analysis[section].title || !analysis[section].content) {
        errors.push({
          type: ValidationErrorType.MISSING_REQUIRED_FIELD,
          field: `analysis.${section}`,
          message: `analysis.${section} must have title and content fields`
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate conclusion structure
   */
  private static validateConclusionStructure(conclusion: any): {
    errors: ValidationError[];
    warnings: string[];
  } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!conclusion || typeof conclusion !== 'object') {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'conclusion',
        message: 'conclusion must be an object',
        expectedType: 'object',
        actualType: typeof conclusion
      });
      return { errors, warnings };
    }

    if (!conclusion.summary) {
      errors.push({
        type: ValidationErrorType.MISSING_REQUIRED_FIELD,
        field: 'conclusion.summary',
        message: 'conclusion.summary is required'
      });
    }

    if (!conclusion.recommendations || typeof conclusion.recommendations !== 'object') {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'conclusion.recommendations',
        message: 'conclusion.recommendations must be an object',
        expectedType: 'object',
        actualType: typeof conclusion.recommendations
      });
    }

    if (!conclusion.keyDifferences || !Array.isArray(conclusion.keyDifferences)) {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'conclusion.keyDifferences',
        message: 'conclusion.keyDifferences must be an array',
        expectedType: 'array',
        actualType: typeof conclusion.keyDifferences
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate switch comparison metadata
   */
  private static validateSwitchComparisonMetadata(metadata: any): {
    errors: ValidationError[];
    warnings: string[];
  } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!metadata || typeof metadata !== 'object') {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'metadata',
        message: 'metadata must be an object',
        expectedType: 'object',
        actualType: typeof metadata
      });
      return { errors, warnings };
    }

    if (typeof metadata.switchesCompared !== 'number') {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'metadata.switchesCompared',
        message: 'metadata.switchesCompared must be a number',
        expectedType: 'number',
        actualType: typeof metadata.switchesCompared
      });
    }

    if (typeof metadata.allSwitchesFoundInDatabase !== 'boolean') {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'metadata.allSwitchesFoundInDatabase',
        message: 'metadata.allSwitchesFoundInDatabase must be a boolean',
        expectedType: 'boolean',
        actualType: typeof metadata.allSwitchesFoundInDatabase
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate error field structure
   */
  private static validateErrorField(error: any): {
    errors: ValidationError[];
    warnings: string[];
  } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (typeof error !== 'object') {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'error',
        message: 'error must be an object',
        expectedType: 'object',
        actualType: typeof error
      });
      return { errors, warnings };
    }

    const requiredErrorFields = ['errorType', 'errorMessage', 'timestamp'];
    for (const field of requiredErrorFields) {
      if (!error[field]) {
        errors.push({
          type: ValidationErrorType.MISSING_REQUIRED_FIELD,
          field: `error.${field}`,
          message: `error.${field} is required`
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate metadata structure
   */
  private static validateMetadata(metadata: any): {
    errors: ValidationError[];
    warnings: string[];
  } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (typeof metadata !== 'object') {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_TYPE,
        field: 'metadata',
        message: 'metadata must be an object',
        expectedType: 'object',
        actualType: typeof metadata
      });
    }

    return { errors, warnings };
  }
}

/**
 * Export middleware function for easy use
 */
export const validateResponse = (options?: {
  enableStrictValidation?: boolean;
  logValidationErrors?: boolean;
}) => {
  const middleware = new ResponseValidationMiddleware(options);
  return middleware.validateResponse();
}; 
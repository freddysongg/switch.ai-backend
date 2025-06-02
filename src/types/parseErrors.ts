/**
 * Error types for ResponseParserService operations
 * 
 * Categorizes different types of parsing failures to enable
 * appropriate error handling and recovery strategies.
 */
export enum ParseErrorType {
  /** Malformed or invalid markdown structure */
  MARKDOWN_MALFORMED = 'MARKDOWN_MALFORMED',
  
  /** Content too short or missing required sections */
  INSUFFICIENT_CONTENT = 'INSUFFICIENT_CONTENT',
  
  /** Transformation logic failed during execution */
  TRANSFORMER_FAILED = 'TRANSFORMER_FAILED',
  
  /** Failed to extract sections from markdown */
  SECTION_EXTRACTION_FAILED = 'SECTION_EXTRACTION_FAILED',
  
  /** Table parsing encountered errors */
  TABLE_PARSING_FAILED = 'TABLE_PARSING_FAILED',
  
  /** List parsing encountered errors */
  LIST_PARSING_FAILED = 'LIST_PARSING_FAILED',
  
  /** Unknown or unsupported response type */
  UNKNOWN_RESPONSE_TYPE = 'UNKNOWN_RESPONSE_TYPE',
  
  /** Content validation checks failed */
  CONTENT_VALIDATION_FAILED = 'CONTENT_VALIDATION_FAILED'
}

/**
 * Custom error class for parser-specific errors
 * 
 * Provides structured error information including error type,
 * original error context, and additional debugging information.
 */
export class ParseError extends Error {
  public readonly type: ParseErrorType;
  public readonly originalError?: Error;
  public readonly context?: Record<string, any>;

  /**
   * Creates a new ParseError instance
   * 
   * @param type - The specific type of parsing error
   * @param message - Human-readable error message
   * @param originalError - The original error that caused this parsing error
   * @param context - Additional context information for debugging
   */
  constructor(
    type: ParseErrorType,
    message: string,
    originalError?: Error,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'ParseError';
    this.type = type;
    this.originalError = originalError;
    this.context = context;
  }

  /**
   * Returns a formatted error message with context
   */
  public getDetailedMessage(): string {
    let details = `[${this.type}] ${this.message}`;
    
    if (this.originalError) {
      details += `\nCaused by: ${this.originalError.message}`;
    }
    
    if (this.context) {
      details += `\nContext: ${JSON.stringify(this.context, null, 2)}`;
    }
    
    return details;
  }

  /**
   * Determines if this error type should be retried
   */
  public isRetryable(): boolean {
    const retryableTypes = [
      ParseErrorType.TRANSFORMER_FAILED,
      ParseErrorType.SECTION_EXTRACTION_FAILED,
      ParseErrorType.TABLE_PARSING_FAILED,
      ParseErrorType.LIST_PARSING_FAILED
    ];
    
    return retryableTypes.includes(this.type);
  }
}

/**
 * Validation error types for input and output validation
 */
export enum ValidationErrorType {
  /** Input parameters are invalid */
  INVALID_INPUT = 'INVALID_INPUT',
  
  /** Content length exceeds limits */
  CONTENT_TOO_LONG = 'CONTENT_TOO_LONG',
  
  /** Content is too short to process */
  CONTENT_TOO_SHORT = 'CONTENT_TOO_SHORT',
  
  /** Output structure doesn't match expected format */
  INVALID_OUTPUT_STRUCTURE = 'INVALID_OUTPUT_STRUCTURE',
  
  /** Required fields are missing from output */
  MISSING_REQUIRED_FIELDS = 'MISSING_REQUIRED_FIELDS'
}

/**
 * Validation error class for input/output validation failures
 */
export class ValidationError extends Error {
  public readonly type: ValidationErrorType;
  public readonly field?: string;
  public readonly expectedValue?: any;
  public readonly actualValue?: any;

  /**
   * Creates a new ValidationError instance
   * 
   * @param type - The specific type of validation error
   * @param message - Human-readable error message
   * @param field - The field that failed validation
   * @param expectedValue - The expected value or format
   * @param actualValue - The actual value that failed validation
   */
  constructor(
    type: ValidationErrorType,
    message: string,
    field?: string,
    expectedValue?: any,
    actualValue?: any
  ) {
    super(message);
    this.name = 'ValidationError';
    this.type = type;
    this.field = field;
    this.expectedValue = expectedValue;
    this.actualValue = actualValue;
  }

  /**
   * Returns validation details for debugging
   */
  public getValidationDetails(): Record<string, any> {
    return {
      type: this.type,
      field: this.field,
      expected: this.expectedValue,
      actual: this.actualValue,
      message: this.message
    };
  }
} 
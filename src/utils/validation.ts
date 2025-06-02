/**
 * Validation utilities for input validation and structure checking
 * 
 * Contains reusable validation functions used throughout the application
 * for ensuring data integrity and proper structure validation.
 */

/**
 * Validation helper functions for content and structure validation
 */
export class ValidationHelpers {
  /**
   * Checks if markdown content has basic structural elements
   * 
   * Analyzes the markdown content to determine if it contains the minimum
   * structural elements needed for successful parsing.
   * 
   * @param markdown - Markdown content to analyze
   * @returns Structure analysis with validity flag
   */
  static checkBasicMarkdownStructure(markdown: string): {
    hasHeaders: boolean;
    hasTables: boolean;
    hasLists: boolean;
    estimatedSections: number;
    isValid: boolean;
  } {
    const hasHeaders = /^#{1,6}\s+.+$/m.test(markdown);
    const hasTables = /\|.*\|/.test(markdown);
    const hasLists = /^[\s]*[-*+]\s+.+$/m.test(markdown) || /^[\s]*\d+\.\s+.+$/m.test(markdown);
    const estimatedSections = (markdown.match(/^#{1,6}\s+.+$/gm) || []).length;

    return {
      hasHeaders,
      hasTables,
      hasLists,
      estimatedSections,
      isValid: hasHeaders || hasTables || hasLists || markdown.length > 100
    };
  }

  /**
   * Validates that an object contains all required fields
   * 
   * Checks if the provided data object contains all the required fields
   * for the specific response type.
   * 
   * @param data - Object to validate
   * @param requiredFields - Array of required field names
   * @returns Validation result with missing fields
   */
  static validateRequiredFields(data: any, requiredFields: string[]): {
    isValid: boolean;
    missingFields: string[];
  } {
    if (!data || typeof data !== 'object') {
      return {
        isValid: false,
        missingFields: requiredFields
      };
    }

    const missingFields = requiredFields.filter(field => {
      return !(field in data) || data[field] === undefined || data[field] === null;
    });

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }
} 
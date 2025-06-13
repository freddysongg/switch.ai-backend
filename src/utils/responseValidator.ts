/**
 * Response Validator Utility for SwitchAI Response Quality Enhancement
 *
 * Purpose: Validate response structure and format before delivery to resolve
 * test compliance issues and ensure consistent markdown structure
 */

import { AnalysisResponse, QueryIntent } from '../types/analysis.js';
import { validateIntent } from './intentMapping.js';
import { getRequiredSections } from './promptTemplates.js';
import { generateTechnicalSpecificationsTable } from './tableGenerator.js';

export interface ValidationResult {
  isValid: boolean;
  compliance: ComplianceScores;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

export interface ComplianceScores {
  formatScore: number;
  sectionScore: number;
  structureScore: number;
  overallScore: number;
}

export interface ValidationError {
  type:
    | 'missing_header'
    | 'invalid_format'
    | 'empty_section'
    | 'malformed_table'
    | 'invalid_structure';
  message: string;
  section?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface ValidationWarning {
  type: 'formatting' | 'content_quality' | 'structure' | 'completeness';
  message: string;
  section?: string;
  suggestion: string;
}

/**
 * Main validation function - validates response content against intent requirements
 */
export function validateMarkdownStructure(content: string, intent: QueryIntent): ValidationResult {
  const normalizedIntent = validateIntent(intent);

  const requiredSections = getRequiredSections(normalizedIntent);

  const sectionValidation = validateRequiredSections(content, requiredSections);
  const formatValidation = validateMarkdownFormat(content);
  const structureValidation = validateContentStructure(content, normalizedIntent);
  const tableValidation = validateTables(content, normalizedIntent);

  const compliance = calculateComplianceScores({
    sectionValidation,
    formatValidation,
    structureValidation,
    tableValidation
  });

  const errors = [
    ...sectionValidation.errors,
    ...formatValidation.errors,
    ...structureValidation.errors,
    ...tableValidation.errors
  ];

  const warnings = [
    ...sectionValidation.warnings,
    ...formatValidation.warnings,
    ...structureValidation.warnings,
    ...tableValidation.warnings
  ];

  const suggestions = generateSuggestions(errors, warnings, normalizedIntent);

  return {
    isValid: compliance.overallScore >= 70,
    compliance,
    errors,
    warnings,
    suggestions
  };
}

/**
 * Validate that all required sections are present
 */
export function validateRequiredSections(
  content: string,
  requiredSections: string[]
): {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  foundSections: string[];
  missingSections: string[];
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const foundSections: string[] = [];
  const missingSections: string[] = [];

  const headerRegex = /^##\s+(.+)$/gm;
  const matches = content.matchAll(headerRegex);
  const contentHeaders = Array.from(matches, (m) => `## ${m[1].trim()}`);

  for (const requiredSection of requiredSections) {
    const sectionFound = contentHeaders.some(
      (header) => header.toLowerCase() === requiredSection.toLowerCase()
    );

    if (sectionFound) {
      foundSections.push(requiredSection);
    } else {
      missingSections.push(requiredSection);
      errors.push({
        type: 'missing_header',
        message: `Required section missing: ${requiredSection}`,
        section: requiredSection,
        severity: 'critical'
      });
    }
  }

  for (const section of foundSections) {
    if (isSectionEmpty(content, section)) {
      warnings.push({
        type: 'completeness',
        message: `Section "${section}" appears to be empty or minimal`,
        section,
        suggestion: `Add substantive content to ${section}`
      });
    }
  }

  return { errors, warnings, foundSections, missingSections };
}

/**
 * Validate overall markdown formatting
 */
export function validateMarkdownFormat(content: string): {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  formatScore: number;
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let formatScore = 100;

  const jsonPattern = /\{[^}]*"[^"]+"\s*:/;
  if (jsonPattern.test(content)) {
    errors.push({
      type: 'invalid_format',
      message: 'Content contains JSON-like structures instead of markdown',
      severity: 'critical'
    });
    formatScore -= 40;
  }

  const invalidHeaderPattern = /^#{1}\s|^#{3,}\s/gm;
  const invalidHeaders = content.match(invalidHeaderPattern);
  if (invalidHeaders) {
    warnings.push({
      type: 'formatting',
      message: `Found ${invalidHeaders.length} headers with non-standard levels (only ## should be used)`,
      suggestion: 'Use ## for all main section headers'
    });
    formatScore -= invalidHeaders.length * 5;
  }

  const boldFormatIssues = checkBoldFormatting(content);
  if (boldFormatIssues > 0) {
    warnings.push({
      type: 'formatting',
      message: `Potential issues with bold formatting (${boldFormatIssues} instances)`,
      suggestion: 'Ensure switch names and key terms use **bold** formatting'
    });
    formatScore -= boldFormatIssues * 2;
  }

  const listFormatIssues = checkListFormatting(content);
  if (listFormatIssues > 0) {
    warnings.push({
      type: 'formatting',
      message: `Found ${listFormatIssues} potential list formatting issues`,
      suggestion: 'Use proper markdown list syntax (- for bullets, 1. for numbered)'
    });
    formatScore -= listFormatIssues * 3;
  }

  const strictFormattingIssues = validateStrictMarkdownFormatting(content);
  errors.push(...strictFormattingIssues.errors);
  warnings.push(...strictFormattingIssues.warnings);
  formatScore -= strictFormattingIssues.penaltyPoints;

  return { errors, warnings, formatScore: Math.max(0, formatScore) };
}

/**
 * Comprehensive markdown formatting consistency checks
 * Validates headers, tables, bullet points with strict standards
 */
function validateStrictMarkdownFormatting(content: string): {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  penaltyPoints: number;
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let penaltyPoints = 0;

  const headerIssues = validateHeaderConsistency(content);
  errors.push(...headerIssues.errors);
  warnings.push(...headerIssues.warnings);
  penaltyPoints += headerIssues.penalty;

  const tableIssues = validateTableConsistency(content);
  errors.push(...tableIssues.errors);
  warnings.push(...tableIssues.warnings);
  penaltyPoints += tableIssues.penalty;

  const bulletIssues = validateBulletPointConsistency(content);
  errors.push(...bulletIssues.errors);
  warnings.push(...bulletIssues.warnings);
  penaltyPoints += bulletIssues.penalty;

  const spacingIssues = validateLineSpacing(content);
  warnings.push(...spacingIssues.warnings);
  penaltyPoints += spacingIssues.penalty;

  return { errors, warnings, penaltyPoints };
}

/**
 * Validate header consistency and proper formatting
 */
function validateHeaderConsistency(content: string): {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  penalty: number;
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let penalty = 0;

  const requiredHeaders = ['## Overview', '## Technical Specifications', '## Analysis'];

  for (const requiredHeader of requiredHeaders) {
    const exactMatch = content.includes(requiredHeader);
    const partialMatch = new RegExp(`##\\s*${requiredHeader.substring(3).trim()}`, 'i').test(
      content
    );

    if (!exactMatch && partialMatch) {
      warnings.push({
        type: 'formatting',
        message: `Header "${requiredHeader}" found but with incorrect formatting`,
        suggestion: `Use exact format: "${requiredHeader}"`
      });
      penalty += 5;
    } else if (!exactMatch && !partialMatch) {
      errors.push({
        type: 'missing_header',
        message: `Required header "${requiredHeader}" not found`,
        severity: 'critical'
      });
      penalty += 15;
    }
  }

  const headerRegex = /^##\s+(.+)$/gm;
  const headers = Array.from(content.matchAll(headerRegex), (m) => m[1]);

  for (const header of headers) {
    if (header !== header.trim()) {
      warnings.push({
        type: 'formatting',
        message: `Header has extra whitespace: "## ${header}"`,
        suggestion: 'Remove extra spaces from headers'
      });
      penalty += 2;
    }

    const words = header.split(' ');
    const hasInconsistentCase = words.some(
      (word) => word.length > 3 && word[0] !== word[0].toUpperCase()
    );

    if (hasInconsistentCase) {
      warnings.push({
        type: 'formatting',
        message: `Header may have inconsistent title case: "## ${header}"`,
        suggestion: 'Use title case for headers: "## Technical Specifications"'
      });
      penalty += 1;
    }
  }

  return { errors, warnings, penalty };
}

/**
 * Validate table structure and formatting consistency
 */
function validateTableConsistency(content: string): {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  penalty: number;
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let penalty = 0;

  const tableRegex = /^\|.+\|$/gm;
  const tableLines = content.match(tableRegex) || [];

  if (tableLines.length === 0) {
    if (content.includes('## Technical Specifications')) {
      warnings.push({
        type: 'completeness',
        message: 'Technical Specifications section found but no table present',
        suggestion: 'Add a table with switch specifications'
      });
      penalty += 10;
    }
    return { errors, warnings, penalty };
  }

  const tables = groupTableLines(tableLines, content);

  for (const table of tables) {
    const tableValidation = validateSingleTable(table);
    errors.push(...tableValidation.errors);
    warnings.push(...tableValidation.warnings);
    penalty += tableValidation.penalty;
  }

  return { errors, warnings, penalty };
}

/**
 * Validate individual table structure
 */
function validateSingleTable(tableLines: string[]): {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  penalty: number;
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let penalty = 0;

  if (tableLines.length < 2) {
    errors.push({
      type: 'malformed_table',
      message: 'Table must have at least header and separator rows',
      severity: 'high'
    });
    penalty += 15;
    return { errors, warnings, penalty };
  }

  const headerRow = tableLines[0];
  const separatorRow = tableLines[1];
  const dataRows = tableLines.slice(2);

  const separatorPattern = /^\|[\s\-:]+\|$/;
  if (!separatorPattern.test(separatorRow)) {
    errors.push({
      type: 'malformed_table',
      message: 'Table separator row is malformed',
      severity: 'high'
    });
    penalty += 10;
  }

  const headerCols = (headerRow.match(/\|/g) || []).length - 1;
  const separatorCols = (separatorRow.match(/\|/g) || []).length - 1;

  if (headerCols !== separatorCols) {
    errors.push({
      type: 'malformed_table',
      message: 'Table header and separator have different column counts',
      severity: 'high'
    });
    penalty += 10;
  }

  for (let i = 0; i < dataRows.length; i++) {
    const dataCols = (dataRows[i].match(/\|/g) || []).length - 1;
    if (dataCols !== headerCols) {
      warnings.push({
        type: 'formatting',
        message: `Table row ${i + 3} has ${dataCols} columns, expected ${headerCols}`,
        suggestion: 'Ensure all table rows have the same number of columns'
      });
      penalty += 3;
    }
  }

  const expectedHeaders = [
    'Property',
    'Value',
    'Switch',
    'Type',
    'Manufacturer',
    'Actuation Force'
  ];
  const headerText = headerRow.toLowerCase();
  let foundExpectedHeaders = 0;

  for (const expectedHeader of expectedHeaders) {
    if (headerText.includes(expectedHeader.toLowerCase())) {
      foundExpectedHeaders++;
    }
  }

  if (foundExpectedHeaders === 0) {
    warnings.push({
      type: 'content_quality',
      message: 'Table headers do not match expected technical specification format',
      suggestion: 'Use headers like "Property", "Value", "Switch", "Type", etc.'
    });
    penalty += 5;
  }

  return { errors, warnings, penalty };
}

/**
 * Validate bullet point formatting consistency
 */
function validateBulletPointConsistency(content: string): {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  penalty: number;
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let penalty = 0;

  const bulletPatterns = [
    /^[\s]*-[\s]+/gm,
    /^[\s]*\*[\s]+/gm,
    /^[\s]*\+[\s]+/gm,
    /^[\s]*\d+\.[\s]+/gm
  ];

  const allBullets: string[] = [];
  for (const pattern of bulletPatterns) {
    const matches = content.match(pattern) || [];
    allBullets.push(...matches);
  }

  if (allBullets.length === 0) {
    return { errors, warnings, penalty };
  }

  const dashBullets = content.match(/^[\s]*-[\s]+/gm) || [];
  const asteriskBullets = content.match(/^[\s]*\*[\s]+/gm) || [];
  const plusBullets = content.match(/^[\s]*\+[\s]+/gm) || [];

  const bulletStyles = [dashBullets.length, asteriskBullets.length, plusBullets.length];
  const nonZeroStyles = bulletStyles.filter((count) => count > 0).length;

  if (nonZeroStyles > 1) {
    warnings.push({
      type: 'formatting',
      message: 'Multiple bullet point styles found (-, *, +)',
      suggestion: 'Use consistent bullet style throughout (recommend using - for bullets)'
    });
    penalty += 5;
  }

  const improperSpacing = content.match(/^[\s]*[-\*\+][\s]{2,}/gm) || [];
  if (improperSpacing.length > 0) {
    warnings.push({
      type: 'formatting',
      message: `Found ${improperSpacing.length} bullet points with excessive spacing`,
      suggestion: 'Use single space after bullet points: "- item"'
    });
    penalty += improperSpacing.length;
  }

  return { errors, warnings, penalty };
}

/**
 * Validate line spacing and overall structure
 */
function validateLineSpacing(content: string): {
  warnings: ValidationWarning[];
  penalty: number;
} {
  const warnings: ValidationWarning[] = [];
  let penalty = 0;

  const excessiveEmptyLines = content.match(/\n\n\n+/g) || [];
  if (excessiveEmptyLines.length > 0) {
    warnings.push({
      type: 'formatting',
      message: 'Found sections with more than 2 consecutive empty lines',
      suggestion: 'Use maximum of 2 empty lines between sections'
    });
    penalty += excessiveEmptyLines.length * 2;
  }

  const headerRegex = /^##\s+.+$/gm;
  const headers = content.match(headerRegex) || [];

  for (const header of headers) {
    const headerIndex = content.indexOf(header);
    const afterHeader = content.substring(
      headerIndex + header.length,
      headerIndex + header.length + 10
    );

    if (!afterHeader.startsWith('\n')) {
      warnings.push({
        type: 'formatting',
        message: `Header "${header}" may be missing line break`,
        suggestion: 'Add line break after headers'
      });
      penalty += 2;
    }
  }

  return { warnings, penalty };
}

/**
 * Helper function to group table lines that belong together
 */
function groupTableLines(tableLines: string[], content: string): string[][] {
  const tables: string[][] = [];
  let currentTable: string[] = [];

  for (const line of tableLines) {
    const lineIndex = content.indexOf(line);
    const prevLineIndex =
      currentTable.length > 0 ? content.indexOf(currentTable[currentTable.length - 1]) : -1;

    if (
      currentTable.length > 0 &&
      lineIndex > prevLineIndex + currentTable[currentTable.length - 1].length + 50
    ) {
      if (currentTable.length > 0) {
        tables.push([...currentTable]);
      }
      currentTable = [line];
    } else {
      currentTable.push(line);
    }
  }

  if (currentTable.length > 0) {
    tables.push(currentTable);
  }

  return tables;
}

/**
 * Validate content structure and organization
 */
export function validateContentStructure(
  content: string,
  intent: QueryIntent
): {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  structureScore: number;
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let structureScore = 100;

  const headerOrder = extractHeaderOrder(content);
  const expectedOrder = getRequiredSections(intent);

  if (!validateSectionOrder(headerOrder, expectedOrder)) {
    warnings.push({
      type: 'structure',
      message: 'Sections are not in the expected order',
      suggestion: `Expected order: ${expectedOrder.join(' → ')}`
    });
    structureScore -= 15;
  }

  const sectionLengths = analyzeSectionLengths(content);
  const imbalancedSections = findImbalancedSections(sectionLengths);

  if (imbalancedSections.length > 0) {
    warnings.push({
      type: 'content_quality',
      message: `Unbalanced content distribution in: ${imbalancedSections.join(', ')}`,
      suggestion: 'Ensure each section has adequate detail'
    });
    structureScore -= imbalancedSections.length * 10;
  }

  if (intent === 'switch_comparison') {
    const comparisonStructureScore = validateComparisonStructure(content);
    structureScore = Math.min(structureScore, comparisonStructureScore);
  }

  return { errors, warnings, structureScore: Math.max(0, structureScore) };
}

/**
 * Validate table formatting and content
 * Following intentMapping's format-specific validation
 */
export function validateTables(
  content: string,
  intent: QueryIntent
): {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  tableScore: number;
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let tableScore = 100;

  const tables = extractTables(content);

  if (tables.length === 0 && shouldHaveTables(intent)) {
    errors.push({
      type: 'missing_header',
      message: `Intent "${intent}" should include technical specification tables`,
      severity: 'high'
    });
    tableScore -= 30;
  }

  for (const table of tables) {
    const tableValidation = validateTableStructure(table);
    if (!tableValidation.isValid) {
      errors.push({
        type: 'malformed_table',
        message: `Table formatting issues: ${tableValidation.issues.join(', ')}`,
        severity: 'medium'
      });
      tableScore -= 15;
    }

    if (tableValidation.warnings.length > 0) {
      warnings.push({
        type: 'formatting',
        message: `Table formatting warnings: ${tableValidation.warnings.join(', ')}`,
        suggestion: 'Ensure consistent table formatting with proper headers and alignment'
      });
      tableScore -= 5;
    }
  }

  return { errors, warnings, tableScore: Math.max(0, tableScore) };
}

/**
 * Convert JSON response to markdown format
 * Critical function to resolve JSON vs markdown mismatch
 */
export function convertJSONToMarkdown(response: AnalysisResponse, intent: QueryIntent): string {
  const normalizedIntent = validateIntent(intent);

  try {
    switch (normalizedIntent) {
      case 'switch_comparison':
        return convertComparisonToMarkdown(response);
      case 'general_switch_info':
        return convertGeneralInfoToMarkdown(response);
      case 'material_analysis':
        return convertMaterialAnalysisToMarkdown(response);
      case 'follow_up_question':
        return convertFollowUpToMarkdown(response);
      default:
        return convertDefaultToMarkdown(response);
    }
  } catch (error) {
    console.error('Error converting JSON to markdown:', error);
    return generateFallbackMarkdown(response, intent);
  }
}

/**
 * Helper Functions
 */

function isSectionEmpty(content: string, sectionHeader: string): boolean {
  const sectionRegex = new RegExp(`${sectionHeader}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
  const match = content.match(sectionRegex);

  if (!match) return true;

  const sectionContent = match[1].trim();
  return sectionContent.length < 50;
}

function checkBoldFormatting(content: string): number {
  let issues = 0;

  const switchNamePattern =
    /(?<!\*\*)\b[A-Za-z]+\s*(?:Linear|Tactile|Clicky|Switch|Red|Blue|Brown|Black)\b(?!\*\*)/g;
  const unboldedSwitches = content.match(switchNamePattern);
  if (unboldedSwitches) {
    issues += unboldedSwitches.length;
  }

  return issues;
}

function checkListFormatting(content: string): number {
  let issues = 0;

  const lines = content.split('\n');
  let inList = false;
  let listType: 'bullet' | 'numbered' | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.match(/^[-*+]\s/)) {
      if (listType === 'numbered') issues++;
      listType = 'bullet';
      inList = true;
    } else if (trimmed.match(/^\d+\.\s/)) {
      if (listType === 'bullet') issues++;
      listType = 'numbered';
      inList = true;
    } else if (trimmed === '' && inList) {
      continue;
    } else {
      inList = false;
      listType = null;
    }
  }

  return issues;
}

function extractHeaderOrder(content: string): string[] {
  const headerRegex = /^##\s+(.+)$/gm;
  const matches = content.matchAll(headerRegex);
  return Array.from(matches, (m) => `## ${m[1].trim()}`);
}

function validateSectionOrder(actual: string[], expected: string[]): boolean {
  const actualLower = actual.map((h) => h.toLowerCase());
  const expectedLower = expected.map((h) => h.toLowerCase());

  let expectedIndex = 0;
  for (const header of actualLower) {
    if (expectedIndex < expectedLower.length && header === expectedLower[expectedIndex]) {
      expectedIndex++;
    }
  }

  return expectedIndex === expectedLower.length;
}

function analyzeSectionLengths(content: string): Map<string, number> {
  const sections = new Map<string, number>();
  const headerRegex = /^##\s+(.+)$/gm;
  const contentSections = content.split(headerRegex);

  for (let i = 1; i < contentSections.length; i += 2) {
    const header = `## ${contentSections[i].trim()}`;
    const content = contentSections[i + 1] || '';
    sections.set(header, content.trim().length);
  }

  return sections;
}

function findImbalancedSections(sectionLengths: Map<string, number>): string[] {
  const lengths = Array.from(sectionLengths.values());
  if (lengths.length === 0) return [];

  const average = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const threshold = average * 0.3;

  return Array.from(sectionLengths.entries())
    .filter(([_, length]) => length < threshold)
    .map(([header, _]) => header);
}

function validateComparisonStructure(content: string): number {
  let score = 100;

  const comparativeWords = ['compared to', 'versus', 'while', 'however', 'in contrast', 'differs'];
  const foundComparativeWords = comparativeWords.filter((word) =>
    content.toLowerCase().includes(word)
  );

  if (foundComparativeWords.length < 2) {
    score -= 20;
  }

  return score;
}

function extractTables(content: string): string[] {
  const tableRegex = /\|[^|\n]*\|[^|\n]*\|\n\|[-:|]+\|[-:|]+\|[\s\S]*?(?=\n\n|\n##|$)/g;
  return Array.from(content.matchAll(tableRegex), (m) => m[0]);
}

function shouldHaveTables(intent: QueryIntent): boolean {
  return ['switch_comparison', 'general_switch_info'].includes(intent);
}

function validateTableStructure(table: string): {
  isValid: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];

  const lines = table.trim().split('\n');

  if (lines.length < 2) {
    issues.push('Table too short (missing header or separator)');
    return { isValid: false, issues, warnings };
  }

  const separatorLine = lines[1];
  if (!separatorLine.match(/^\|[-:|]+\|/)) {
    issues.push('Invalid table separator format');
  }

  const columnCounts = lines
    .filter((line) => line.includes('|'))
    .map((line) => line.split('|').length);

  const uniqueCounts = [...new Set(columnCounts)];
  if (uniqueCounts.length > 1) {
    issues.push('Inconsistent column count across table rows');
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings
  };
}

function calculateComplianceScores(validationResults: any): ComplianceScores {
  const { sectionValidation, formatValidation, structureValidation, _tableValidation } =
    validationResults;

  const sectionScore =
    sectionValidation.foundSections.length === 0
      ? 0
      : (sectionValidation.foundSections.length /
          (sectionValidation.foundSections.length + sectionValidation.missingSections.length)) *
        100;

  const formatScore = formatValidation.formatScore;

  const structureScore = structureValidation.structureScore;

  const overallScore = Math.round(sectionScore * 0.4 + formatScore * 0.3 + structureScore * 0.3);

  return {
    formatScore: Math.round(formatScore),
    sectionScore: Math.round(sectionScore),
    structureScore: Math.round(structureScore),
    overallScore
  };
}

function generateSuggestions(
  errors: ValidationError[],
  warnings: ValidationWarning[],
  intent: QueryIntent
): string[] {
  const suggestions: string[] = [];

  const criticalErrors = errors.filter((e) => e.severity === 'critical');
  if (criticalErrors.length > 0) {
    suggestions.push('Address critical format issues first for immediate improvement');
  }

  const missingSections = errors.filter((e) => e.type === 'missing_header');
  if (missingSections.length > 0) {
    suggestions.push(`Add required sections: ${missingSections.map((e) => e.section).join(', ')}`);
  }

  if (warnings.some((w) => w.type === 'formatting')) {
    suggestions.push('Review markdown formatting for consistency and correctness');
  }

  if (intent === 'switch_comparison' && warnings.some((w) => w.message.includes('comparative'))) {
    suggestions.push('Use more comparative language and direct comparisons between switches');
  }

  return suggestions;
}

function convertComparisonToMarkdown(response: AnalysisResponse): string {
  const techSpecsTable = generateTechnicalSpecificationsTable(response, 'comparison');

  return `## Overview
${response.overview || 'Comprehensive comparison of the requested switches.'}

## Technical Specifications
${techSpecsTable}

## Comparative Analysis
${response.analysis || 'Detailed analysis of switch characteristics and differences.'}

## Conclusion
${response.conclusion || 'Summary of key findings and recommendations.'}`;
}

function convertGeneralInfoToMarkdown(response: AnalysisResponse): string {
  const techSpecsTable = generateTechnicalSpecificationsTable(response, 'general_info');

  return `## Overview
${response.overview || 'Comprehensive information about the requested switch.'}

## Technical Specifications
${techSpecsTable}

## Analysis
${response.analysis || 'Detailed analysis of switch characteristics and performance.'}

## Recommendations
${response.recommendations || 'Recommendations for different use cases and preferences.'}`;
}

function convertMaterialAnalysisToMarkdown(response: AnalysisResponse): string {
  return `## Overview
${response.overview || 'Analysis of material properties and applications.'}

## Material Analysis
${response.materialAnalysis?.materialComposition || response.analysis || 'Detailed examination of material characteristics and properties.'}

## Example Switches
${response.exampleSwitches?.map((sw) => `- **${sw.switchName}**: ${sw.briefOverview || 'Switch example'}`).join('\n') || 'Examples of switches using this material.'}

## Applications
${response.materialAnalysis?.switchApplications || 'Practical applications and considerations for this material.'}`;
}

function convertFollowUpToMarkdown(response: AnalysisResponse): string {
  return `## Overview
${response.overview || 'Response to your follow-up question.'}

## Analysis
${response.analysis || 'Detailed analysis addressing your specific question.'}

## Context
${response.contextualConnection || 'Additional context and related information.'}`;
}

function convertDefaultToMarkdown(response: AnalysisResponse): string {
  return `## Overview
${response.overview || response.analysis || 'Response to your query.'}`;
}

function generateFallbackMarkdown(response: AnalysisResponse, intent: QueryIntent): string {
  const sections = getRequiredSections(intent);

  let markdown = '';
  for (const section of sections) {
    markdown += `${section}\n`;
    markdown += `${response.overview || response.analysis || 'Information not available.'}\n\n`;
  }

  return markdown.trim();
}

/**
 * Main export function for integration with existing services
 * Following intentMapping's simple integration pattern
 */
export function validateResponse(content: string, intent: QueryIntent): ValidationResult {
  return validateMarkdownStructure(content, intent);
}

/**
 * Quick validation check function
 * Following intentMapping's utility pattern
 */
export function isValidMarkdown(content: string, intent: QueryIntent): boolean {
  const result = validateMarkdownStructure(content, intent);
  return result.isValid;
}

/**
 * Debug function for development and testing
 * Following intentMapping's debugging pattern
 */
export function debugValidation(content: string, intent: QueryIntent): any {
  const result = validateMarkdownStructure(content, intent);

  return {
    intent: intent,
    normalizedIntent: validateIntent(intent),
    requiredSections: getRequiredSections(validateIntent(intent)),
    validationResult: result,
    contentPreview: content.substring(0, 200) + '...'
  };
}

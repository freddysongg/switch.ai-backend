/**
 * Table Generator Utility for SwitchAI Response Quality Enhancement
 *
 * Purpose: Generate properly formatted markdown tables for technical specifications
 * with database integration and graceful fallbacks
 *
 * Extracted from responseValidator.ts for better code organization
 */

import { AnalysisResponse } from '../types/analysisTypes.js';

/**
 * ENHANCEMENT 2.7: Generate proper technical specification tables with database integration
 * Handles database data availability and provides graceful fallbacks for N/A values
 */
export function generateTechnicalSpecificationsTable(
  response: AnalysisResponse,
  queryType: 'comparison' | 'general_info'
): string {
  // Check if we have database specifications in the response
  const hasDbSpecs =
    response.technicalSpecifications && Object.keys(response.technicalSpecifications).length > 0;

  if (hasDbSpecs) {
    return generateDatabaseIntegratedTable(response.technicalSpecifications!, queryType);
  } else {
    return generateFallbackSpecificationsTable(response, queryType);
  }
}

/**
 * Generate table with actual database specifications
 */
export function generateDatabaseIntegratedTable(
  specs: any,
  queryType: 'comparison' | 'general_info'
): string {
  // Define expected headers based on test requirements
  const standardHeaders = ['Property', 'Value'];
  const comparisonHeaders = [
    'Switch',
    'Type',
    'Manufacturer',
    'Actuation Force',
    'Travel Distance'
  ];

  if (queryType === 'comparison' && isComparisonData(specs)) {
    return generateComparisonTable(specs, comparisonHeaders);
  } else {
    return generatePropertyValueTable(specs, standardHeaders);
  }
}

/**
 * Check if specifications contain comparison data (multiple switches)
 */
export function isComparisonData(specs: any): boolean {
  // Look for multiple switch entries or switch-specific keys
  return (
    Array.isArray(specs) ||
    Object.keys(specs).some((key) => key.includes('switch') || key.includes('Switch')) ||
    Object.values(specs).some((value) => Array.isArray(value))
  );
}

/**
 * Generate comparison table with multiple switches
 */
export function generateComparisonTable(specs: any, headers: string[]): string {
  let table = `| ${headers.join(' | ')} |\n`;
  table += `| ${headers.map(() => '-------').join(' | ')} |\n`;

  if (Array.isArray(specs)) {
    // Handle array of switch objects
    for (const switchData of specs) {
      const row = headers.map((header) => {
        const value = extractValueForHeader(switchData, header);
        return formatTableValue(value);
      });
      table += `| ${row.join(' | ')} |\n`;
    }
  } else {
    // Handle object with switch properties
    const switches = extractSwitchesFromSpecs(specs);
    for (const switchName of switches) {
      const row = headers.map((header) => {
        if (header === 'Switch') return switchName;
        const value = extractSwitchProperty(specs, switchName, header);
        return formatTableValue(value);
      });
      table += `| ${row.join(' | ')} |\n`;
    }
  }

  return table;
}

/**
 * Generate standard property-value table
 */
export function generatePropertyValueTable(specs: any, headers: string[]): string {
  let table = `| ${headers.join(' | ')} |\n`;
  table += `| ${headers.map(() => '-------').join(' | ')} |\n`;

  // Map specs to property-value pairs
  const properties = Object.entries(specs);
  for (const [property, value] of properties) {
    const formattedProperty = formatPropertyName(property);
    const formattedValue = formatTableValue(value);
    table += `| ${formattedProperty} | ${formattedValue} |\n`;
  }

  return table;
}

/**
 * Generate fallback table when database is empty
 */
export function generateFallbackSpecificationsTable(
  response: AnalysisResponse,
  queryType: 'comparison' | 'general_info'
): string {
  if (queryType === 'comparison') {
    return `| Switch | Type | Manufacturer | Actuation Force | Travel Distance |
| ------ | ---- | ------------ | --------------- | --------------- |
| Information not available in database | N/A | N/A | N/A | N/A |

*Note: Specifications not available in database. Please refer to the analysis section for available information.*`;
  } else {
    return `| Property | Value |
| -------- | ----- |
| Type | Not Available |
| Manufacturer | Not Available |
| Actuation Force | Not Available |
| Travel Distance | Not Available |

*Note: Detailed specifications not available in database. Please refer to the analysis section for available information.*`;
  }
}

/**
 * Helper functions for table generation
 */
export function extractValueForHeader(switchData: any, header: string): any {
  const headerMap: { [key: string]: string[] } = {
    Switch: ['name', 'switchName', 'switch_name'],
    Type: ['type', 'switchType', 'switch_type'],
    Manufacturer: ['manufacturer', 'brand', 'company'],
    'Actuation Force': ['actuationForce', 'actuation_force', 'force'],
    'Travel Distance': ['travelDistance', 'travel_distance', 'distance']
  };

  const possibleKeys = headerMap[header] || [header.toLowerCase()];

  for (const key of possibleKeys) {
    if (switchData[key] !== undefined) {
      return switchData[key];
    }
  }

  return null;
}

export function extractSwitchesFromSpecs(specs: any): string[] {
  // Extract switch names from various possible structures
  const switches: string[] = [];

  for (const [key, value] of Object.entries(specs)) {
    if (
      key.toLowerCase().includes('switch') ||
      (typeof value === 'object' && value !== null && 'name' in value)
    ) {
      switches.push(key);
    }
  }

  return switches.length > 0 ? switches : ['Unknown Switch'];
}

export function extractSwitchProperty(specs: any, switchName: string, property: string): any {
  const switchData = specs[switchName];
  if (!switchData) return null;

  return extractValueForHeader(switchData, property);
}

export function formatPropertyName(property: string): string {
  // Convert camelCase or snake_case to readable format
  return property
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatTableValue(value: any): string {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    // Add unit formatting for common measurements
    if (value < 10 && value > 0) {
      return `${value}mm`; // Likely travel distance
    } else if (value > 10 && value < 200) {
      return `${value}g`; // Likely actuation force
    }
    return value.toString();
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return String(value);
}

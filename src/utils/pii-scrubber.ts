/**
 * PII Scrubbing Utility for SwitchAI
 *
 * Detects and redacts personally identifiable information (PII) from user content
 * before inclusion in LLM prompts. This prevents accidental exposure of sensitive
 * data and ensures compliance with privacy regulations.
 *
 */

export interface PIIDetectionResult {
  hasDetectedPII: boolean;
  scrubbedText: string;
  detectedTypes: PIIType[];
  redactedCount: number;
  originalLength: number;
  scrubbedLength: number;
  confidence: 'high' | 'medium' | 'low';
  detectionDetails: PIIDetection[];
}

export interface PIIDetection {
  type: PIIType;
  originalText: string;
  redactedText: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
  pattern: string;
}

export type PIIType =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'address'
  | 'ip_address'
  | 'url'
  | 'name'
  | 'birth_date'
  | 'passport'
  | 'license_plate'
  | 'bank_account'
  | 'medical_id'
  | 'custom_id';

export interface PIIPattern {
  name: PIIType;
  regex: RegExp;
  replacement: string | ((match: string) => string);
  confidence: number;
  description: string;
  enabled: boolean;
}

export interface PIIScrubberConfig {
  enabledPatterns: PIIType[];
  aggressiveMode: boolean;
  preserveFormat: boolean;
  logDetections: boolean;
  customPatterns?: PIIPattern[];
}

/**
 * Comprehensive PII detection and scrubbing utility
 */
export class PIIScrubber {
  private static readonly DEFAULT_PATTERNS: PIIPattern[] = [
    {
      name: 'email',
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      replacement: '[EMAIL_REDACTED]',
      confidence: 0.95,
      description: 'Email addresses',
      enabled: true
    },

    {
      name: 'phone',
      regex: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
      replacement: '[PHONE_REDACTED]',
      confidence: 0.85,
      description: 'Phone numbers',
      enabled: true
    },

    {
      name: 'ssn',
      regex: /\b(?:\d{3}[-.\s]?\d{2}[-.\s]?\d{4}|\d{9})\b/g,
      replacement: '[SSN_REDACTED]',
      confidence: 0.8,
      description: 'Social Security Numbers',
      enabled: true
    },

    {
      name: 'credit_card',
      regex: /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g,
      replacement: '[CARD_REDACTED]',
      confidence: 0.9,
      description: 'Credit card numbers',
      enabled: true
    },

    {
      name: 'ip_address',
      regex: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
      replacement: '[IP_REDACTED]',
      confidence: 0.7,
      description: 'IP addresses',
      enabled: true
    },

    {
      name: 'url',
      regex:
        /https?:\/\/(?:[-\w.])+(?:\:[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:\#(?:[\w.])*)?)?/g,
      replacement: '[URL_REDACTED]',
      confidence: 0.85,
      description: 'URLs',
      enabled: true
    },

    {
      name: 'address',
      regex:
        /\b\d+\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Place|Pl|Court|Ct)\b/gi,
      replacement: '[ADDRESS_REDACTED]',
      confidence: 0.65,
      description: 'Street addresses',
      enabled: true
    },

    {
      name: 'birth_date',
      regex: /\b(?:0?[1-9]|1[0-2])[-\/](?:0?[1-9]|[12][0-9]|3[01])[-\/](?:19|20)\d{2}\b/g,
      replacement: '[DATE_REDACTED]',
      confidence: 0.6,
      description: 'Birth dates',
      enabled: true
    },

    {
      name: 'name',
      regex: /\b(?:my name is|i am|i'm)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\b/gi,
      replacement: '[NAME_REDACTED_CONTEXT]',
      confidence: 0.5,
      description: 'Explicit name mentions',
      enabled: false
    },

    {
      name: 'bank_account',
      regex: /\b(?:account|acct|acc)(?:\s*#?:?\s*)(\d{8,17})\b/gi,
      replacement: '[BANK_ACCOUNT_REDACTED]',
      confidence: 0.75,
      description: 'Bank account numbers',
      enabled: true
    },

    {
      name: 'license_plate',
      regex: /\b[A-Z]{1,3}[-\s]?\d{1,4}[-\s]?[A-Z]{0,3}\b/g,
      replacement: '[LICENSE_PLATE_REDACTED]',
      confidence: 0.45,
      description: 'License plates',
      enabled: false
    }
  ];

  private static readonly DEFAULT_CONFIG: PIIScrubberConfig = {
    enabledPatterns: [
      'email',
      'phone',
      'ssn',
      'credit_card',
      'ip_address',
      'url',
      'address',
      'birth_date',
      'bank_account'
    ],
    aggressiveMode: false,
    preserveFormat: true,
    logDetections: true,
    customPatterns: []
  };

  /**
   * Main method to scrub PII from text content
   * @param text The text to scrub
   * @param config Configuration options for scrubbing
   * @returns Detailed results of PII detection and scrubbing
   */
  static scrubPII(text: string, config?: Partial<PIIScrubberConfig>): PIIDetectionResult {
    if (!text || typeof text !== 'string') {
      return {
        hasDetectedPII: false,
        scrubbedText: text || '',
        detectedTypes: [],
        redactedCount: 0,
        originalLength: 0,
        scrubbedLength: 0,
        confidence: 'high',
        detectionDetails: []
      };
    }

    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const patterns = this.getEnabledPatterns(finalConfig);

    let scrubbedText = text;
    const detections: PIIDetection[] = [];
    const detectedTypes = new Set<PIIType>();

    for (const pattern of patterns) {
      const matches = this.findMatches(scrubbedText, pattern);

      for (const match of matches) {
        detections.push(match);
        detectedTypes.add(pattern.name);

        scrubbedText = scrubbedText.replace(match.originalText, match.redactedText);
      }
    }

    const overallConfidence = this.calculateOverallConfidence(detections);

    if (finalConfig.logDetections && detections.length > 0) {
      this.logPIIDetections(detections, text.length, scrubbedText.length);
    }

    return {
      hasDetectedPII: detections.length > 0,
      scrubbedText,
      detectedTypes: Array.from(detectedTypes),
      redactedCount: detections.length,
      originalLength: text.length,
      scrubbedLength: scrubbedText.length,
      confidence: overallConfidence,
      detectionDetails: detections
    };
  }

  /**
   * Quick method to just get scrubbed text without detailed analysis
   * @param text The text to scrub
   * @param enabledTypes Optional array of PII types to check for
   * @returns Scrubbed text
   */
  static quickScrub(text: string, enabledTypes?: PIIType[]): string {
    if (!text) return text;

    const config: Partial<PIIScrubberConfig> = {
      logDetections: false,
      enabledPatterns: enabledTypes || this.DEFAULT_CONFIG.enabledPatterns
    };

    return this.scrubPII(text, config).scrubbedText;
  }

  /**
   * Check if text contains PII without scrubbing
   * @param text The text to check
   * @param enabledTypes Optional array of PII types to check for
   * @returns Whether PII was detected
   */
  static containsPII(text: string, enabledTypes?: PIIType[]): boolean {
    if (!text) return false;

    const config: Partial<PIIScrubberConfig> = {
      logDetections: false,
      enabledPatterns: enabledTypes || this.DEFAULT_CONFIG.enabledPatterns
    };

    return this.scrubPII(text, config).hasDetectedPII;
  }

  /**
   * Scrub PII from conversation history
   * @param messages Array of conversation messages
   * @param userRoleOnly Whether to only scrub user messages
   * @returns Scrubbed messages
   */
  static scrubConversationHistory(
    messages: Array<{ role: string; content: string; [key: string]: any }>,
    userRoleOnly: boolean = true
  ): Array<{ role: string; content: string; [key: string]: any }> {
    return messages.map((message) => {
      if (!userRoleOnly || message.role === 'user') {
        return {
          ...message,
          content: this.quickScrub(message.content)
        };
      }
      return message;
    });
  }

  /**
   * Get enabled patterns based on configuration
   */
  private static getEnabledPatterns(config: PIIScrubberConfig): PIIPattern[] {
    const allPatterns = [...this.DEFAULT_PATTERNS];

    if (config.customPatterns) {
      allPatterns.push(...config.customPatterns);
    }

    return allPatterns.filter(
      (pattern) => pattern.enabled && config.enabledPatterns.includes(pattern.name)
    );
  }

  /**
   * Find all matches for a given pattern in text
   */
  private static findMatches(text: string, pattern: PIIPattern): PIIDetection[] {
    const matches: PIIDetection[] = [];
    let match;

    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);

    while ((match = regex.exec(text)) !== null) {
      const originalText = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + originalText.length;

      let redactedText: string;
      if (typeof pattern.replacement === 'function') {
        redactedText = pattern.replacement(originalText);
      } else {
        redactedText = pattern.replacement;
      }

      matches.push({
        type: pattern.name,
        originalText,
        redactedText,
        startIndex,
        endIndex,
        confidence: pattern.confidence,
        pattern: pattern.regex.source
      });

      if (!pattern.regex.global) break;
    }

    return matches;
  }

  /**
   * Calculate overall confidence based on detected patterns
   */
  private static calculateOverallConfidence(detections: PIIDetection[]): 'high' | 'medium' | 'low' {
    if (detections.length === 0) return 'high';

    const avgConfidence = detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length;

    if (avgConfidence >= 0.8) return 'high';
    if (avgConfidence >= 0.6) return 'medium';
    return 'low';
  }

  /**
   * Log PII detections for monitoring and compliance
   */
  private static logPIIDetections(
    detections: PIIDetection[],
    originalLength: number,
    scrubbedLength: number
  ): void {
    const timestamp = new Date().toISOString();
    const detectionSummary = detections.reduce(
      (acc, detection) => {
        acc[detection.type] = (acc[detection.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    console.log(`[PII_SCRUBBER] ${timestamp} - PII Detection Summary:`);
    console.log(`[PII_SCRUBBER] - Total detections: ${detections.length}`);
    console.log(`[PII_SCRUBBER] - Text length: ${originalLength} → ${scrubbedLength} characters`);
    console.log(`[PII_SCRUBBER] - Detected types:`, detectionSummary);

    detections.forEach((detection, index) => {
      console.log(
        `[PII_SCRUBBER] - Detection ${index + 1}: ${detection.type} (confidence: ${Math.round(detection.confidence * 100)}%)`
      );
    });
  }

  /**
   * Validate that scrubbing was effective
   * @param originalText Original text
   * @param scrubbedText Scrubbed text
   * @param enabledTypes Types that were checked
   * @returns Validation result
   */
  static validateScrubbing(
    originalText: string,
    scrubbedText: string,
    enabledTypes?: PIIType[]
  ): {
    isValid: boolean;
    remainingPII: PIIDetection[];
    validationConfidence: 'high' | 'medium' | 'low';
  } {
    const remainingPIIResult = this.scrubPII(scrubbedText, {
      logDetections: false,
      enabledPatterns: enabledTypes || this.DEFAULT_CONFIG.enabledPatterns
    });

    return {
      isValid: !remainingPIIResult.hasDetectedPII,
      remainingPII: remainingPIIResult.detectionDetails,
      validationConfidence: remainingPIIResult.confidence
    };
  }
}

/**
 * Utility functions for common PII scrubbing scenarios
 */
export class PIIUtils {
  /**
   * Scrub PII from user query before sending to LLM
   */
  static scrubUserQuery(query: string): string {
    return PIIScrubber.quickScrub(query, ['email', 'phone', 'ssn', 'credit_card', 'address']);
  }

  /**
   * Scrub PII from database content before including in prompts
   */
  static scrubDatabaseContent(content: string): string {
    return PIIScrubber.quickScrub(content, ['email', 'phone', 'address', 'url']);
  }

  /**
   * Check if user input might contain sensitive information
   */
  static containsSensitiveInfo(text: string): boolean {
    return PIIScrubber.containsPII(text, ['email', 'phone', 'ssn', 'credit_card', 'bank_account']);
  }

  /**
   * Get a safe excerpt of text for logging purposes
   */
  static createSafeExcerpt(text: string, maxLength: number = 100): string {
    const scrubbed = PIIScrubber.quickScrub(text);
    return scrubbed.length > maxLength ? scrubbed.substring(0, maxLength) + '...' : scrubbed;
  }
}

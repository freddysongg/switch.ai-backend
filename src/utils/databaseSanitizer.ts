/**
 * Database Content Sanitizer
 *
 * Sanitizes content retrieved from the database before insertion into LLM prompts
 * to prevent potential prompt injection attacks through compromised database data.
 */

export interface SanitizationResult {
  sanitizedContent: string;
  wasModified: boolean;
  removedPatterns: string[];
}

export class DatabaseSanitizer {
  private static readonly SUSPICIOUS_PATTERNS = [
    // Prompt injection attempts
    /ignore\s+(previous|all)\s+(instructions?|prompts?|rules?)/gi,
    /forget\s+(everything|all|previous)/gi,
    /act\s+as\s+(if\s+)?you\s+(are|were)/gi,
    /pretend\s+(to\s+be|you\s+are)/gi,
    /roleplay\s+as/gi,
    /simulate\s+(being|a)/gi,

    // System override attempts
    /system\s*[:=]/gi,
    /assistant\s*[:=]/gi,
    /human\s*[:=]/gi,
    /user\s*[:=]/gi,
    /\[system\]/gi,
    /\[assistant\]/gi,
    /\[user\]/gi,
    /<system>/gi,
    /<assistant>/gi,
    /<user>/gi,

    // Instruction injection
    /"""[\s\S]*?"""/g,
    /```[\s\S]*?```/g,
    /\{\{[\s\S]*?\}\}/g,
    /\[\[[\s\S]*?\]\]/g,

    // JSON/Object injection attempts
    /\{\s*["']?(role|content|system|assistant|user)["']?\s*:/gi,

    // Template injection
    /\$\{[\s\S]*?\}/g,
    /%\{[\s\S]*?\}/g,

    // Special tokens and delimiters
    /<\|.*?\|>/g,
    /\[INST\]|\[\/INST\]/gi,
    /<s>|<\/s>/g,

    // Control characters and escape sequences
    /[\x00-\x1F\x7F]/g,
    /\\x[0-9a-f]{2}/gi,
    /\\u[0-9a-f]{4}/gi,

    // Suspicious markdown that could break prompt structure
    /#+\s*(system|assistant|user|instruction)/gi
  ];

  // Characters that need encoding to prevent breaking prompt structure
  private static readonly ESCAPE_MAPPINGS: Record<string, string> = {
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '&': '&amp;'
  };

  /**
   * Sanitize a single string value from the database
   */
  static sanitizeString(content: string | null | undefined): SanitizationResult {
    if (!content || typeof content !== 'string') {
      return {
        sanitizedContent: content || '',
        wasModified: false,
        removedPatterns: []
      };
    }

    let sanitized = content;
    const removedPatterns: string[] = [];
    let wasModified = false;

    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      const matches = sanitized.match(pattern);

      if (matches) {
        removedPatterns.push(`Pattern: ${pattern.toString()}`);
        sanitized = sanitized.replace(pattern, '[CONTENT_REMOVED]');
        wasModified = true;
      }
    }

    const originalSanitized = sanitized;
    for (const [char, replacement] of Object.entries(this.ESCAPE_MAPPINGS)) {
      sanitized = sanitized.replace(new RegExp(char, 'g'), replacement);
    }

    if (sanitized !== originalSanitized) {
      wasModified = true;
      removedPatterns.push('HTML entity encoding applied');
    }

    const MAX_CONTENT_LENGTH = 1000;
    if (sanitized.length > MAX_CONTENT_LENGTH) {
      sanitized = sanitized.substring(0, MAX_CONTENT_LENGTH) + '...[TRUNCATED]';
      wasModified = true;
      removedPatterns.push('Content truncated due to length');
    }

    return {
      sanitizedContent: sanitized,
      wasModified,
      removedPatterns
    };
  }

  /**
   * Sanitize a switch context object from the database
   */
  static sanitizeSwitchContext(context: any): {
    sanitizedContext: any;
    sanitizationLog: SanitizationResult[];
  } {
    if (!context || typeof context !== 'object') {
      return {
        sanitizedContext: context,
        sanitizationLog: []
      };
    }

    const sanitizedContext = { ...context };
    const sanitizationLog: SanitizationResult[] = [];

    const fieldsToSanitize = [
      'description_text',
      'name',
      'manufacturer',
      'type',
      'spring',
      'topHousing',
      'bottomHousing',
      'stem',
      'mount',
      'additionalNotesDb',
      'notes'
    ];

    for (const field of fieldsToSanitize) {
      if (field in sanitizedContext) {
        const result = this.sanitizeString(sanitizedContext[field]);
        sanitizedContext[field] = result.sanitizedContent;

        if (result.wasModified) {
          sanitizationLog.push({
            ...result,
            sanitizedContent: `${field}: ${result.sanitizedContent}`
          });
        }
      }
    }

    return {
      sanitizedContext,
      sanitizationLog
    };
  }

  /**
   * Sanitize an array of switch contexts
   */
  static sanitizeSwitchContextArray(contexts: any[]): {
    sanitizedContexts: any[];
    overallSanitizationLog: SanitizationResult[];
  } {
    if (!Array.isArray(contexts)) {
      return {
        sanitizedContexts: contexts || [],
        overallSanitizationLog: []
      };
    }

    const sanitizedContexts: any[] = [];
    const overallSanitizationLog: SanitizationResult[] = [];

    for (let i = 0; i < contexts.length; i++) {
      const { sanitizedContext, sanitizationLog } = this.sanitizeSwitchContext(contexts[i]);
      sanitizedContexts.push(sanitizedContext);

      sanitizationLog.forEach((log) => {
        overallSanitizationLog.push({
          ...log,
          sanitizedContent: `Context[${i}] ${log.sanitizedContent}`
        });
      });
    }

    return {
      sanitizedContexts,
      overallSanitizationLog
    };
  }

  /**
   * Sanitize database JSON objects that might be included in prompts
   */
  static sanitizeDatabaseJSON(data: any): {
    sanitizedData: any;
    sanitizationLog: SanitizationResult[];
  } {
    if (!data || typeof data !== 'object') {
      return {
        sanitizedData: data,
        sanitizationLog: []
      };
    }

    const sanitizationLog: SanitizationResult[] = [];

    const sanitizeObject = (obj: any, path: string = ''): any => {
      if (typeof obj === 'string') {
        const result = this.sanitizeString(obj);
        if (result.wasModified) {
          sanitizationLog.push({
            ...result,
            sanitizedContent: `${path}: ${result.sanitizedContent}`
          });
        }
        return result.sanitizedContent;
      }

      if (Array.isArray(obj)) {
        return obj.map((item, index) => sanitizeObject(item, `${path}[${index}]`));
      }

      if (obj && typeof obj === 'object') {
        const sanitizedObj: any = {};
        for (const [key, value] of Object.entries(obj)) {
          const newPath = path ? `${path}.${key}` : key;
          sanitizedObj[key] = sanitizeObject(value, newPath);
        }
        return sanitizedObj;
      }

      return obj;
    };

    const sanitizedData = sanitizeObject(data);

    return {
      sanitizedData,
      sanitizationLog
    };
  }

  /**
   * Log sanitization activities for security monitoring
   */
  static logSanitization(
    operationType: string,
    sanitizationLog: SanitizationResult[],
    requestContext?: any
  ): void {
    if (sanitizationLog.length === 0) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'DATABASE_CONTENT_SANITIZATION',
      operation: operationType,
      sanitizedItems: sanitizationLog.length,
      removedPatterns: sanitizationLog.flatMap((log) => log.removedPatterns),
      context: requestContext
        ? {
            requestId: requestContext.requestId,
            endpoint: requestContext.endpoint
          }
        : undefined
    };

    console.warn('[DATABASE_SANITIZATION_APPLIED]', JSON.stringify(logEntry));

    // TODO: In production, integrate with proper security logging service
    // securityLogger.warn('Database content sanitized', logEntry);
  }

  /**
   * Quick sanitization check for critical security patterns
   */
  static hasHighRiskContent(content: string): boolean {
    if (!content || typeof content !== 'string') {
      return false;
    }

    const highRiskPatterns = [
      /ignore\s+(all|previous)/i,
      /system\s*[:=]/i,
      /\[system\]/i,
      /<system>/i,
      /""".*system.*"""/i,
      /```.*system.*```/i
    ];

    return highRiskPatterns.some((pattern) => pattern.test(content));
  }
}

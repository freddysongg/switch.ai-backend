import { NextFunction, Request, Response } from 'express';

const PROMPT_INJECTION_PATTERNS = [
  // Direct instruction patterns
  /ignore\s+(previous|all)\s+(instructions?|prompts?|rules?)/i,
  /forget\s+(everything|all|previous)/i,
  /act\s+as\s+(if\s+)?you\s+(are|were)/i,
  /pretend\s+(to\s+be|you\s+are)/i,
  /roleplay\s+as/i,
  /simulate\s+(being|a)/i,
  /override\s+(previous|system|safety)/i,
  /bypass\s+(security|safety|filter)/i,

  // System override patterns
  /system\s*[:=]\s*/i,
  /assistant\s*[:=]\s*/i,
  /human\s*[:=]\s*/i,
  /user\s*[:=]\s*/i,
  /admin\s*[:=]\s*/i,
  /root\s*[:=]\s*/i,
  /\[system\]/i,
  /\[assistant\]/i,
  /\[user\]/i,
  /\[admin\]/i,
  /<s>/i,
  /<assistant>/i,
  /<user>/i,
  /<system>/i,

  // Injection attempts
  /"""[\s\S]*?"""/,
  /```[\s\S]*?```/,
  /\{\{[\s\S]*?\}\}/,
  /\$\{[\s\S]*?\}/,
  /<%[\s\S]*?%>/,
  /\{\%[\s\S]*?\%\}/,

  // Direct commands and code execution
  /^(execute|run|eval|import|require|fetch|load|exec)\s+/i,
  /\b(delete|drop|truncate|alter|update|insert|create|grant|revoke)\s+/i,
  /\b(sudo|su|chmod|chown|rm\s+-rf|dd\s+if=)/i,
  /\b(powershell|cmd|bash|sh|zsh|fish)\s+/i,

  // Prompt escaping attempts
  /\\n\\n/,
  /\\r\\n/,
  /\\t/,
  /\x00/,
  /\x1a/,
  /\x1b/,

  // Malicious instruction patterns
  /tell\s+me\s+(how\s+to\s+)?(hack|exploit|bypass|crack|break)/i,
  /generate\s+(malware|virus|harmful|illegal)/i,
  /create\s+(fake|fraudulent|malicious|illegal)/i,
  /show\s+me\s+(passwords?|secrets?|keys?|tokens?)/i,

  // Base64/hex/unicode obfuscation attempts
  /(?:[A-Za-z0-9+\/]{4}){10,}(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?/,
  /(?:0x[0-9a-fA-F]{2,}){5,}/,
  /(?:\\u[0-9a-fA-F]{4}){5,}/,
  /(?:\\x[0-9a-fA-F]{2}){5,}/,

  // SQL injection patterns
  /'\s*(or|and)\s+['"]\s*['"]\s*=/i,
  /union\s+select/i,
  /insert\s+into/i,
  /update\s+set/i,
  /delete\s+from/i,

  // XSS patterns
  /<script[\s\S]*?>/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /<iframe[\s\S]*?>/i,
  /<object[\s\S]*?>/i,
  /<embed[\s\S]*?>/i,

  // Command injection patterns
  /[;&|`$(){}]/,
  /\|\s*\w+/,
  /&&|\|\|/,

  // Path traversal patterns
  /\.\.[\/\\]/,
  /\/etc\/passwd/i,
  /\/etc\/shadow/i,
  /\/proc\/version/i,

  // LLM-specific attack patterns
  /continue\s+in\s+developer\s+mode/i,
  /jailbreak/i,
  /dan\s+mode/i,
  /evil\s+mode/i,
  /uncensored/i,
  /unrestricted/i,
  /without\s+any\s+(restrictions?|limitations?|filters?)/i,
  /enable\s+(developer|debug|admin)\s+mode/i
];

// SQL injection specific patterns
const SQL_INJECTION_PATTERNS = [
  /'\s*(or|and)\s+['"]\s*['"]\s*=/i,
  /union\s+select/i,
  /select\s+.*\s+from/i,
  /insert\s+into/i,
  /update\s+.*\s+set/i,
  /delete\s+from/i,
  /drop\s+(table|database)/i,
  /alter\s+table/i,
  /create\s+(table|database)/i,
  /grant\s+.*\s+to/i,
  /revoke\s+.*\s+from/i,
  /exec(\s+|\()/i,
  /execute(\s+|\()/i,
  /sp_/i,
  /xp_/i,
  /benchmark\s*\(/i,
  /sleep\s*\(/i,
  /pg_sleep\s*\(/i,
  /waitfor\s+delay/i
];

// XSS specific patterns
const XSS_PATTERNS = [
  /<script[\s\S]*?>/i,
  /<\/script>/i,
  /javascript:/i,
  /vbscript:/i,
  /on\w+\s*=/i,
  /<iframe[\s\S]*?>/i,
  /<object[\s\S]*?>/i,
  /<embed[\s\S]*?>/i,
  /<applet[\s\S]*?>/i,
  /<meta[\s\S]*?>/i,
  /<link[\s\S]*?>/i,
  /<style[\s\S]*?>/i,
  /expression\s*\(/i,
  /url\s*\(/i,
  /@import/i,
  /behavior\s*:/i,
  /-moz-binding/i,
  /mocha:/i,
  /livescript:/i
];

// Command injection specific patterns
const COMMAND_INJECTION_PATTERNS = [
  /[;&|`$]/,
  /\|\s*\w+/,
  /&&|\|\|/,
  /\$\(.*\)/,
  /`.*`/,
  /\$\{.*\}/,
  />\s*\/dev\/null/,
  /2>&1/,
  /\/bin\/(sh|bash|csh|ksh|zsh)/,
  /\/usr\/bin\/(env|python|perl|ruby|php)/,
  /cmd\.exe/i,
  /powershell/i,
  /wscript/i,
  /cscript/i
];

// Configuration for special character limits
const SPECIAL_CHAR_CONFIG = {
  maxSpecialCharPercentage: 30,
  maxConsecutiveSpecialChars: 5,
  blockedChars: [
    '\x00',
    '\x01',
    '\x02',
    '\x03',
    '\x04',
    '\x05',
    '\x06',
    '\x07',
    '\x08',
    '\x0B',
    '\x0C',
    '\x0E',
    '\x0F',
    '\x10',
    '\x11',
    '\x12',
    '\x13',
    '\x14',
    '\x15',
    '\x16',
    '\x17',
    '\x18',
    '\x19',
    '\x1A',
    '\x1B',
    '\x1C',
    '\x1D',
    '\x1E',
    '\x1F',
    '\x7F'
  ],
  maxInputLength: 10000,
  maxFieldDepth: 5
};

// Obfuscation detection patterns
const OBFUSCATION_PATTERNS = [
  /(?:[A-Za-z0-9+\/]{4}){10,}(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?/,
  /(?:0x[0-9a-fA-F]{2,}){5,}/,
  /(?:\\x[0-9a-fA-F]{2}){5,}/,
  // Unicode encoding patterns
  /(?:\\u[0-9a-fA-F]{4}){5,}/,
  /(?:%[0-9a-fA-F]{2}){5,}/,
  // HTML entity encoding
  /(?:&#[0-9]{2,4};){5,}/,
  /(?:&[a-zA-Z]{2,8};){5,}/,
  // ROT13 and similar
  /[a-zA-Z]{20,}/,
  // Binary patterns
  /(?:[01]{8}){5,}/,
  // Excessive whitespace patterns
  /\s{50,}/,
  // Zero-width characters
  /[\u200B\u200C\u200D\u2060\uFEFF]/
];

// Advanced validation configuration
const VALIDATION_CONFIG = {
  maxSuspiciousPatterns: 3,
  maxEncodingAttempts: 2,
  maxRepeatedChars: 20,
  suspiciousKeywords: [
    'prompt',
    'instruction',
    'system',
    'admin',
    'root',
    'execute',
    'eval',
    'bypass',
    'override'
  ]
};

/**
 * Enhanced sanitization result interface
 */
interface SanitizationResult {
  isValid: boolean;
  violations: string[];
  suspiciousPatterns: string[];
  risk: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
}

/**
 * Enhanced logging service for rejected inputs
 */
class EnhancedInputSanitizationLogger {
  private static instance: EnhancedInputSanitizationLogger;

  public static getInstance(): EnhancedInputSanitizationLogger {
    if (!EnhancedInputSanitizationLogger.instance) {
      EnhancedInputSanitizationLogger.instance = new EnhancedInputSanitizationLogger();
    }
    return EnhancedInputSanitizationLogger.instance;
  }

  logSecurityEvent(
    ip: string,
    userId: string | undefined,
    input: string,
    result: SanitizationResult,
    endpoint: string,
    userAgent?: string
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      ip,
      userId: userId || 'anonymous',
      endpoint,
      userAgent: userAgent || 'unknown',
      risk: result.risk,
      confidence: result.confidence,
      violations: result.violations,
      suspiciousPatterns: result.suspiciousPatterns,
      inputLength: input.length,
      inputSample: input.substring(0, 200) + (input.length > 200 ? '...' : ''),
      inputHash: this.hashInput(input)
    };

    if (result.risk === 'critical' || result.risk === 'high') {
      console.error('[SECURITY_ALERT]', JSON.stringify(logEntry, null, 2));
    } else {
      console.warn('[INPUT_SANITIZATION_BLOCK]', JSON.stringify(logEntry, null, 2));
    }
  }

  private hashInput(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}

/**
 * Advanced function to sanitize and validate query input
 * @param query - The input query to sanitize
 * @returns SanitizationResult with validation status and details
 */
export function sanitizeQuery(query: string): SanitizationResult {
  const result: SanitizationResult = {
    isValid: true,
    violations: [],
    suspiciousPatterns: [],
    risk: 'low',
    confidence: 0
  };

  if (query.length > SPECIAL_CHAR_CONFIG.maxInputLength) {
    result.isValid = false;
    result.violations.push('Input exceeds maximum length');
    result.risk = 'high';
  }

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(query)) {
      result.isValid = false;
      result.violations.push('Prompt injection pattern detected');
      result.risk = 'critical';
      result.confidence += 0.3;
    }
  }

  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(query)) {
      result.isValid = false;
      result.violations.push('SQL injection pattern detected');
      result.risk = 'critical';
      result.confidence += 0.4;
    }
  }

  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(query)) {
      result.isValid = false;
      result.violations.push('XSS pattern detected');
      result.risk = 'high';
      result.confidence += 0.35;
    }
  }

  for (const pattern of COMMAND_INJECTION_PATTERNS) {
    if (pattern.test(query)) {
      result.isValid = false;
      result.violations.push('Command injection pattern detected');
      result.risk = 'critical';
      result.confidence += 0.4;
    }
  }

  for (const pattern of OBFUSCATION_PATTERNS) {
    if (pattern.test(query)) {
      result.suspiciousPatterns.push('Potential obfuscation detected');
      result.confidence += 0.2;
      if (result.risk === 'low') result.risk = 'medium';
    }
  }

  if (hasExcessiveSpecialChars(query)) {
    result.isValid = false;
    result.violations.push('Excessive special characters detected');
    if (result.risk === 'low') result.risk = 'medium';
  }

  for (const char of SPECIAL_CHAR_CONFIG.blockedChars) {
    if (query.includes(char)) {
      result.isValid = false;
      result.violations.push('Control characters detected');
      result.risk = 'high';
    }
  }

  const suspiciousCount = VALIDATION_CONFIG.suspiciousKeywords.filter((keyword) =>
    query.toLowerCase().includes(keyword.toLowerCase())
  ).length;

  if (suspiciousCount >= VALIDATION_CONFIG.maxSuspiciousPatterns) {
    result.suspiciousPatterns.push('High density of suspicious keywords');
    result.confidence += 0.3;
    if (result.risk === 'low') result.risk = 'medium';
  }

  const repeatedCharPattern = /(.)\1{19,}/;
  if (repeatedCharPattern.test(query)) {
    result.isValid = false;
    result.violations.push('Excessive character repetition detected');
    result.risk = 'high';
  }

  result.confidence = Math.min(result.confidence, 1.0);

  return result;
}

/**
 * Advanced validation function for sanitized queries
 * Performs secondary checks for obfuscation techniques and suspicious patterns
 * @param query - The query to validate
 * @returns SanitizationResult with additional validation details
 */
export function validateSanitizedQuery(query: string): SanitizationResult {
  const result: SanitizationResult = {
    isValid: true,
    violations: [],
    suspiciousPatterns: [],
    risk: 'low',
    confidence: 0
  };

  const decodedVariants = [
    query,
    (() => {
      try {
        return decodeURIComponent(query).replace(/%/g, '');
      } catch {
        return query;
      }
    })(),
    query.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))),
    query.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))),
    query.replace(/&#([0-9]+);/g, (_, num) => String.fromCharCode(parseInt(num, 10))),
    query.replace(/&([a-zA-Z]+);/g, (match) => {
      const entities: { [key: string]: string } = {
        lt: '<',
        gt: '>',
        amp: '&',
        quot: '"',
        apos: "'",
        nbsp: ' ',
        copy: '©',
        reg: '®'
      };
      return entities[match.slice(1, -1)] || match;
    })
  ];

  for (const variant of decodedVariants) {
    if (variant !== query) {
      const variantResult = sanitizeQuery(variant);
      if (!variantResult.isValid) {
        result.isValid = false;
        result.violations.push('Obfuscated malicious content detected');
        result.risk = 'critical';
        result.confidence = Math.max(result.confidence, variantResult.confidence + 0.2);
      }
    }
  }

  const encodingPatterns = [
    /(?:[A-Za-z0-9+\/]{4})*[A-Za-z0-9+\/]{2,3}=*/, // Base64
    /(?:0x[0-9a-fA-F]+)+/, // Hex
    /(?:\\x[0-9a-fA-F]{2})+/, // Hex escape
    /(?:\\u[0-9a-fA-F]{4})+/, // Unicode escape
    /(?:%[0-9a-fA-F]{2})+/ // URL encoding
  ];

  let encodingCount = 0;
  for (const pattern of encodingPatterns) {
    if (pattern.test(query)) {
      encodingCount++;
    }
  }

  if (encodingCount >= VALIDATION_CONFIG.maxEncodingAttempts) {
    result.suspiciousPatterns.push('Multiple encoding schemes detected');
    result.confidence += 0.3;
    if (result.risk === 'low') result.risk = 'medium';
  }

  const homographPattern =
    /[а-яёАЯЁ]|[αβγδεζηθικλμνξοπρστυφχψω]|[αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ]/;
  if (homographPattern.test(query)) {
    result.suspiciousPatterns.push('Potential homograph attack detected');
    result.confidence += 0.25;
    if (result.risk === 'low') result.risk = 'medium';
  }

  const zeroWidthPattern = /[\u200B\u200C\u200D\u2060\uFEFF]/;
  if (zeroWidthPattern.test(query)) {
    result.suspiciousPatterns.push('Zero-width characters detected');
    result.confidence += 0.2;
    if (result.risk === 'low') result.risk = 'medium';
  }

  return result;
}

/**
 * Secure sanitization function that combines multiple validation layers
 * @param query - The input query to sanitize
 * @returns SanitizationResult with comprehensive validation
 */
export function secureSanitizeQuery(query: string): SanitizationResult {
  const basicResult = sanitizeQuery(query);

  const advancedResult = validateSanitizedQuery(query);

  const combinedResult: SanitizationResult = {
    isValid: basicResult.isValid && advancedResult.isValid,
    violations: [...basicResult.violations, ...advancedResult.violations],
    suspiciousPatterns: [...basicResult.suspiciousPatterns, ...advancedResult.suspiciousPatterns],
    risk:
      basicResult.risk === 'critical' || advancedResult.risk === 'critical'
        ? 'critical'
        : basicResult.risk === 'high' || advancedResult.risk === 'high'
          ? 'high'
          : basicResult.risk === 'medium' || advancedResult.risk === 'medium'
            ? 'medium'
            : 'low',
    confidence: Math.max(basicResult.confidence, advancedResult.confidence)
  };

  return combinedResult;
}

/**
 * Checks if the input contains excessive special characters
 */
function hasExcessiveSpecialChars(input: string): boolean {
  const totalChars = input.length;
  if (totalChars === 0) return false;

  const specialCharPattern = /[^a-zA-Z0-9\s.,!?;:'"()-]/g;
  const specialChars = input.match(specialCharPattern) || [];
  const specialCharPercentage = (specialChars.length / totalChars) * 100;

  if (specialCharPercentage > SPECIAL_CHAR_CONFIG.maxSpecialCharPercentage) {
    return true;
  }

  const consecutivePattern = new RegExp(
    `[^a-zA-Z0-9\\s.,!?;:'"()-]{${SPECIAL_CHAR_CONFIG.maxConsecutiveSpecialChars + 1},}`
  );
  if (consecutivePattern.test(input)) {
    return true;
  }

  for (const blockedChar of SPECIAL_CHAR_CONFIG.blockedChars) {
    if (input.includes(blockedChar)) {
      return true;
    }
  }

  return false;
}

/**
 * Enhanced recursive sanitization for objects using new security functions
 */
function sanitizeObject(
  obj: any,
  depth: number = 0
): { hasViolation: boolean; reasons: string[]; risk: string } {
  let hasViolation = false;
  const reasons: string[] = [];
  let maxRisk = 'low';

  if (depth > SPECIAL_CHAR_CONFIG.maxFieldDepth) {
    hasViolation = true;
    reasons.push('Object nesting too deep');
    maxRisk = 'high';
    return { hasViolation, reasons, risk: maxRisk };
  }

  function traverse(value: any, path: string = ''): void {
    if (typeof value === 'string') {
      const result = secureSanitizeQuery(value);

      if (!result.isValid) {
        hasViolation = true;
        reasons.push(...result.violations.map((v) => `${v} in ${path || 'input'}`));
      }

      if (result.risk === 'critical' || maxRisk === 'critical') {
        maxRisk = 'critical';
      } else if (result.risk === 'high' && maxRisk !== 'critical') {
        maxRisk = 'high';
      } else if (result.risk === 'medium' && maxRisk === 'low') {
        maxRisk = 'medium';
      }

      if (result.suspiciousPatterns.length > 0) {
        reasons.push(...result.suspiciousPatterns.map((p) => `${p} in ${path || 'input'}`));
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        traverse(item, `${path}[${index}]`);
      });
    } else if (value && typeof value === 'object') {
      Object.keys(value).forEach((key) => {
        traverse(value[key], path ? `${path}.${key}` : key);
      });
    }
  }

  traverse(obj);
  return { hasViolation, reasons, risk: maxRisk };
}

/**
 * Security testing function for validation
 * @param testCases - Array of test inputs to validate
 * @returns Test results with pass/fail status
 */
export function runSecurityTest(testCases: string[]): {
  passed: number;
  failed: number;
  results: Array<{ input: string; result: SanitizationResult }>;
} {
  const results: Array<{ input: string; result: SanitizationResult }> = [];
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const result = secureSanitizeQuery(testCase);
    results.push({ input: testCase, result });

    if (result.isValid) {
      passed++;
    } else {
      failed++;
    }
  }

  return { passed, failed, results };
}

/**
 * Enhanced input sanitization middleware
 * Protects against prompt injection and validates input integrity using advanced techniques
 */
export const inputSanitization = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const logger = EnhancedInputSanitizationLogger.getInstance();
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = req.user?.id;
    const endpoint = req.originalUrl;
    const userAgent = req.headers['user-agent'];

    const skipPaths = ['/health', '/status', '/metrics', '/favicon.ico'];
    if (skipPaths.includes(req.path)) {
      next();
      return;
    }

    const inputSources = {
      body: req.body,
      query: req.query,
      params: req.params
    };

    let overallRisk = 'low';

    for (const [_, data] of Object.entries(inputSources)) {
      if (data && Object.keys(data).length > 0) {
        const { hasViolation, reasons, risk } = sanitizeObject(data);

        if (risk === 'critical' || overallRisk === 'critical') {
          overallRisk = 'critical';
        } else if (risk === 'high' && overallRisk !== 'critical') {
          overallRisk = 'high';
        } else if (risk === 'medium' && overallRisk === 'low') {
          overallRisk = 'medium';
        }

        if (hasViolation) {
          const logResult: SanitizationResult = {
            isValid: false,
            violations: reasons,
            suspiciousPatterns: [],
            risk: risk as 'low' | 'medium' | 'high' | 'critical',
            confidence: 1.0
          };

          logger.logSecurityEvent(
            clientIp,
            userId,
            JSON.stringify(data),
            logResult,
            endpoint,
            userAgent
          );

          const responseMessage =
            overallRisk === 'critical'
              ? 'Critical security violation detected'
              : overallRisk === 'high'
                ? 'High-risk input detected'
                : 'Invalid input detected';

          res.status(400).json({
            error: 'Invalid input detected',
            message: responseMessage,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          });
          return;
        }
      }
    }

    const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'x-client-ip'];
    for (const headerName of suspiciousHeaders) {
      const headerValue = req.headers[headerName] as string;
      if (headerValue) {
        const result = secureSanitizeQuery(headerValue);
        if (!result.isValid) {
          logger.logSecurityEvent(clientIp, userId, headerValue, result, endpoint, userAgent);

          res.status(400).json({
            error: 'Invalid header detected',
            message: 'Request headers contain suspicious content',
            timestamp: new Date().toISOString()
          });
          return;
        }
      }
    }

    next();
  } catch (error) {
    console.error('Input sanitization middleware error:', error);

    res.status(500).json({
      error: 'Input validation error',
      message: 'Unable to process request due to validation service error',
      timestamp: new Date().toISOString()
    });
  }
};

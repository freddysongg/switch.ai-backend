import { z } from 'zod';

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const nonEmptyStringSchema = z.string().min(1, 'Field cannot be empty').trim();
export const sanitizedStringSchema = z
  .string()
  .trim()
  .max(1000, 'String too long (max 1000 characters)')
  .refine((val: string) => !containsSuspiciousPatterns(val), 'Contains suspicious content');

export const userMessageSchema = z
  .string()
  .trim()
  .min(1, 'Message cannot be empty')
  .max(2000, 'Message too long (max 2000 characters)')
  .refine((val: string) => !containsPromptInjection(val), 'Message contains suspicious patterns')
  .refine((val: string) => val.length >= 3, 'Message too short (min 3 characters)');

export const querySchema = z
  .string()
  .trim()
  .min(3, 'Query too short (min 3 characters)')
  .max(2000, 'Query too long (max 2000 characters)')
  .refine((val: string) => !containsPromptInjection(val), 'Query contains suspicious patterns')
  .refine((val: string) => !val.includes('\x00'), 'Query contains null bytes');

export const conversationIdSchema = z
  .string()
  .min(1, 'Conversation ID cannot be empty')
  .max(100, 'Conversation ID too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Conversation ID contains invalid characters');

export const chatRequestSchema = z
  .object({
    message: userMessageSchema,
    conversationId: conversationIdSchema.optional()
  })
  .strict();

export const chatResponseSchema = z
  .object({
    id: nonEmptyStringSchema,
    role: z.literal('assistant'),
    content: z.string().min(1, 'Response content cannot be empty'),
    metadata: z.record(z.any()).optional(),
    comparisonTable: z.record(z.any()).optional(),
    summary: z.string().optional(),
    recommendations: z
      .array(
        z.object({
          text: nonEmptyStringSchema,
          reasoning: nonEmptyStringSchema
        })
      )
      .optional(),
    switches: z
      .array(
        z.object({
          name: nonEmptyStringSchema,
          manufacturer: nonEmptyStringSchema,
          type: z.string().nullable(),
          relevance_score: z.number().min(0).max(1).optional(),
          justification: z.string().optional()
        })
      )
      .optional()
  })
  .strict();

export const analysisPreferencesSchema = z
  .object({
    detailLevel: z.enum(['brief', 'moderate', 'detailed']).optional(),
    technicalDepth: z.enum(['basic', 'intermediate', 'advanced']).optional(),
    includeRecommendations: z.boolean().optional(),
    maxSwitchesInComparison: z.number().int().min(2).max(10).optional(),
    preferredResponseSections: z.array(z.string().max(50)).max(10).optional(),
    focusAreas: z.array(z.string().max(100)).max(5).optional()
  })
  .strict();

export const followUpContextSchema = z
  .object({
    previousQuery: querySchema.optional(),
    previousResponse: z.record(z.any()).optional(),
    conversationHistory: z
      .array(
        z.object({
          query: querySchema,
          response: z.string().max(5000)
        })
      )
      .max(20)
      .optional()
  })
  .strict();

export const queryHintsSchema = z
  .object({
    expectedIntent: z
      .enum(['general_switch_info', 'switch_comparison', 'material_analysis', 'follow_up_question'])
      .optional(),
    switchNames: z.array(z.string().max(100)).max(10).optional(),
    materials: z.array(z.string().max(50)).max(5).optional(),
    comparisonType: z.enum(['detailed', 'quick']).optional()
  })
  .strict();

export const analysisRequestSchema = z
  .object({
    query: querySchema,
    conversationId: conversationIdSchema.optional(),
    preferences: analysisPreferencesSchema.optional(),
    followUpContext: followUpContextSchema.optional(),
    queryHints: queryHintsSchema.optional(),
    source: z.string().max(50).optional(),
    metadata: z.record(z.any()).optional()
  })
  .strict();

export const intentRequestSchema = z
  .object({
    query: querySchema
  })
  .strict();

export const searchSwitchesSchema = z
  .object({
    query: querySchema,
    limit: z.number().int().min(1).max(50).optional()
  })
  .strict();

export const userIdSchema = z
  .string()
  .min(1, 'User ID cannot be empty')
  .max(100, 'User ID too long')
  .regex(/^[a-zA-Z0-9_@.-]+$/, 'User ID contains invalid characters');

export const userCreateSchema = z
  .object({
    id: userIdSchema,
    email: z.string().email('Invalid email format').max(255),
    app_metadata: z.record(z.any()).optional(),
    user_metadata: z.record(z.any()).optional()
  })
  .strict();

export const userUpdateSchema = z
  .object({
    app_metadata: z.record(z.any()).optional(),
    user_metadata: z.record(z.any()).optional()
  })
  .strict();

export const analyticsEventSchema = z
  .object({
    eventType: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z0-9_.-]+$/, 'Event type contains invalid characters'),
    metadata: z
      .record(z.any())
      .refine(
        (obj: Record<string, any>) => Object.keys(obj).length <= 20,
        'Too many metadata fields (max 20)'
      )
  })
  .strict();

export const adminActionSchema = z
  .object({
    action: z.enum(['reset_rate_limits', 'clear_cache', 'health_check', 'system_status']),
    target: z.string().max(100).optional(),
    parameters: z.record(z.any()).optional()
  })
  .strict();

export const paginationSchema = z.object({
  page: z.number().int().min(1).max(1000).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(20)
});

export const sortingSchema = z.object({
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});

function containsPromptInjection(input: string): boolean {
  const suspiciousPatterns = [
    /ignore\s+(previous|all)\s+(instructions?|prompts?|rules?)/i,
    /forget\s+(everything|all|previous)/i,
    /act\s+as\s+(if\s+)?you\s+(are|were)/i,
    /pretend\s+(to\s+be|you\s+are)/i,
    /roleplay\s+as/i,
    /system\s*[:=]/i,
    /\[system\]/i,
    /<system>/i,
    /"""[\s\S]*?"""/,
    /```[\s\S]*?```/,
    /\{\{[\s\S]*?\}\}/
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(input));
}

function containsSuspiciousPatterns(input: string): boolean {
  const patterns = [
    /[\x00-\x1F\x7F]/, // Control characters
    /\\x[0-9a-f]{2}/i, // Hex escape sequences
    /\\u[0-9a-f]{4}/i, // Unicode escape sequences
    /<script\b/i, // Script tags
    /javascript:/i, // JavaScript URLs
    /on\w+\s*=/i // HTML event handlers
  ];

  return patterns.some((pattern) => pattern.test(input));
}

export const fileNameSchema = z
  .string()
  .max(255, 'Filename too long')
  .regex(/^[a-zA-Z0-9._-]+$/, 'Filename contains invalid characters')
  .refine((name: string) => !name.startsWith('.'), 'Filename cannot start with dot')
  .refine((name: string) => !name.includes('..'), 'Filename cannot contain path traversal');

export const rateLimitConfigSchema = z
  .object({
    windowMs: z.number().int().min(1000).max(3600000),
    maxRequests: z.number().int().min(1).max(10000),
    skipSuccessfulRequests: z.boolean().optional(),
    skipFailedRequests: z.boolean().optional()
  })
  .strict();

export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any) => {
    try {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        const errors = result.error.errors.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: errors
          }
        });
      }

      req.body = result.data;
      next();
    } catch (error) {
      console.error('Validation middleware error:', error);
      return res.status(500).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Internal validation error'
        }
      });
    }
  };
}

export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any) => {
    try {
      const result = schema.safeParse(req.query);

      if (!result.success) {
        const errors = result.error.errors.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Query validation failed',
            details: errors
          }
        });
      }

      req.query = result.data;
      next();
    } catch (error) {
      console.error('Query validation middleware error:', error);
      return res.status(500).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Internal validation error'
        }
      });
    }
  };
}

export function validateParams<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any) => {
    try {
      const result = schema.safeParse(req.params);

      if (!result.success) {
        const errors = result.error.errors.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Parameter validation failed',
            details: errors
          }
        });
      }

      req.params = result.data;
      next();
    } catch (error) {
      console.error('Parameter validation middleware error:', error);
      return res.status(500).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Internal validation error'
        }
      });
    }
  };
}

export const conversationParamsSchema = z
  .object({
    conversationId: conversationIdSchema
  })
  .strict();

export const userParamsSchema = z
  .object({
    userId: userIdSchema
  })
  .strict();

export const messageParamsSchema = z
  .object({
    messageId: uuidSchema
  })
  .strict();

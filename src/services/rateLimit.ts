import { and, asc, desc as drizzleDesc, eq, ilike, sql, SQL } from 'drizzle-orm';
import { validate as isValidUUID } from 'uuid';

import { DatabaseError, ValidationError } from '../db/errors.js';
import { db } from '../db/index.js';
import { rateLimits } from '../db/schema.js';
import { RateLimitListFilters } from '../types/admin.js';
import { RateLimit } from '../types/db.js';

export class AdminRateLimitService {
  async listRateLimits(
    filters: RateLimitListFilters
  ): Promise<{ data: RateLimit[]; total: number }> {
    const {
      userId,
      endpoint,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = filters;
    const conditions: SQL[] = [];
    if (userId) {
      if (!isValidUUID(userId)) throw new ValidationError('Invalid userId format for filter.');
      conditions.push(eq(rateLimits.userId, userId));
    }
    if (endpoint) {
      conditions.push(ilike(rateLimits.endpoint, `%${endpoint}%`));
    }

    const query = db
      .select()
      .from(rateLimits)
      .where(and(...conditions));

    const totalQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(rateLimits)
      .where(and(...conditions));
    const totalResult = await totalQuery.execute();
    const total = totalResult[0]?.count || 0;

    const orderByColumn = rateLimits[sortBy as keyof typeof rateLimits.$inferSelect];
    if (orderByColumn) {
      query.orderBy(sortOrder === 'asc' ? asc(orderByColumn) : drizzleDesc(orderByColumn));
    } else {
      query.orderBy(drizzleDesc(rateLimits.createdAt));
    }

    query.limit(limit).offset((page - 1) * limit);

    try {
      const data = await query.execute();
      return { data, total };
    } catch (error: any) {
      console.error('Error listing rate limits:', error);
      throw new DatabaseError('Failed to list rate limits.', error);
    }
  }

  async deleteRateLimitById(id: string): Promise<{ id: string } | null> {
    if (!isValidUUID(id)) {
      throw new ValidationError('Invalid rate limit ID format.');
    }
    try {
      const deleted = await db
        .delete(rateLimits)
        .where(eq(rateLimits.id, id))
        .returning({ id: rateLimits.id });
      return deleted.length > 0 ? deleted[0] : null;
    } catch (error: any) {
      console.error(`Error deleting rate limit ID ${id}:`, error);
      throw new DatabaseError(`Failed to delete rate limit ID ${id}.`, error);
    }
  }

  async deleteRateLimitsByUserId(userId: string): Promise<{ count: number }> {
    if (!isValidUUID(userId)) {
      throw new ValidationError('Invalid user ID format.');
    }
    try {
      const result = await db.delete(rateLimits).where(eq(rateLimits.userId, userId)).execute();
      console.log(`Rate limits deleted for user ID ${userId}. Result:`, result);
      return { count: -1 };
    } catch (error: any) {
      console.error(`Error deleting rate limits for user ID ${userId}:`, error);
      throw new DatabaseError(`Failed to delete rate limits for user ID ${userId}.`, error);
    }
  }
}

/* eslint-disable unused-imports/no-unused-vars */
import { and, asc, desc as drizzleDesc, eq, gte, ilike, lte, sql, SQL } from 'drizzle-orm';
import { validate as isValidUUID } from 'uuid';

import { DatabaseError, ValidationError } from '../db/errors.js';
import { db } from '../db/index.js';
import { analyticsEvents } from '../db/schema.js';
import { AnalyticsEventListFilters } from '../types/admin.js';
import { AnalyticsEvent as DbAnalyticsEvent } from '../types/db.js';

export class AdminAnalyticsService {
  async listAnalyticsEvents(
    filters: AnalyticsEventListFilters
  ): Promise<{ data: DbAnalyticsEvent[]; total: number }> {
    const {
      userId,
      eventType,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = filters;

    const conditions: SQL[] = [];
    if (userId) {
      if (!isValidUUID(userId)) throw new ValidationError('Invalid userId format for filter.');
      conditions.push(eq(analyticsEvents.userId, userId));
    }
    if (eventType) {
      conditions.push(ilike(analyticsEvents.eventType, `%${eventType}%`));
    }
    if (startDate) {
      try {
        conditions.push(gte(analyticsEvents.createdAt, new Date(startDate)));
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        throw new ValidationError('Invalid startDate format. Please use YYYY-MM-DD.');
      }
    }
    if (endDate) {
      try {
        const inclusiveEndDate = new Date(endDate);
        inclusiveEndDate.setDate(inclusiveEndDate.getDate() + 1);
        conditions.push(lte(analyticsEvents.createdAt, inclusiveEndDate));
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        throw new ValidationError('Invalid endDate format. Please use YYYY-MM-DD.');
      }
    }

    const query = db
      .select()
      .from(analyticsEvents)
      .where(and(...conditions));
    const totalQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(analyticsEvents)
      .where(and(...conditions));

    try {
      const totalResult = await totalQuery.execute();
      const total = totalResult[0]?.count || 0;

      const orderByColumn = analyticsEvents[sortBy as keyof typeof analyticsEvents.$inferSelect];
      if (orderByColumn) {
        query.orderBy(sortOrder === 'asc' ? asc(orderByColumn) : drizzleDesc(orderByColumn));
      } else {
        query.orderBy(drizzleDesc(analyticsEvents.createdAt));
      }

      query.limit(limit).offset((page - 1) * limit);
      const data = await query.execute();
      return { data, total };
    } catch (error: any) {
      console.error('Error listing analytics events:', error);
      throw new DatabaseError('Failed to list analytics events.', error);
    }
  }
}

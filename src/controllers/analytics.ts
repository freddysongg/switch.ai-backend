import { Request, Response } from 'express';

import { DatabaseError, ValidationError } from '@/db/errors';

import { AnalyticsEventListFilters, PaginatedResponse } from '@/types/admin';
import { AnalyticsEvent as DbAnalyticsEvent } from '@/types/db';

import { AdminAnalyticsService } from '@/services/analytics';

export class AdminAnalyticsController {
  private analyticsService: AdminAnalyticsService;

  constructor() {
    this.analyticsService = new AdminAnalyticsService();
  }

  async listAnalyticsEvents(req: Request, res: Response): Promise<void> {
    const queryParams = req.query as unknown as AnalyticsEventListFilters;

    const filters: AnalyticsEventListFilters = {
      userId: queryParams.userId,
      eventType: queryParams.eventType,
      startDate: queryParams.startDate,
      endDate: queryParams.endDate,
      page: queryParams.page ? parseInt(String(queryParams.page), 10) : 1,
      limit: queryParams.limit ? parseInt(String(queryParams.limit), 10) : 20,
      sortBy: queryParams.sortBy || 'createdAt',
      sortOrder: queryParams.sortOrder || 'desc'
    };

    console.log(`GET /api/admin/analytics-events - Filters:`, filters);

    try {
      if (filters.page === undefined || isNaN(filters.page) || filters.page < 1) filters.page = 1;
      if (
        filters.limit === undefined ||
        isNaN(filters.limit) ||
        filters.limit < 1 ||
        filters.limit > 100
      )
        filters.limit = 20;

      const { data, total } = await this.analyticsService.listAnalyticsEvents(filters);

      const response: PaginatedResponse<DbAnalyticsEvent> = {
        data,
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit)
      };
      res.status(200).json(response);
    } catch (error: any) {
      console.error(`GET /api/admin/analytics-events - Error:`, error.message);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof DatabaseError) {
        res.status(500).json({ error: 'Failed to retrieve analytics events.' });
      } else {
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }
}

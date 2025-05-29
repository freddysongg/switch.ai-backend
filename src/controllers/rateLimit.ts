import { Request, Response } from 'express';
import { validate as isValidUUID } from 'uuid';

import { DatabaseError, ValidationError } from '@/db/errors';

import { RateLimitListFilters } from '@/types/admin';

import { AdminRateLimitService } from '@/services/rateLimit';

export class AdminRateLimitController {
  private rateLimitService: AdminRateLimitService;

  constructor() {
    this.rateLimitService = new AdminRateLimitService();
  }

  async listRateLimits(req: Request, res: Response): Promise<void> {
    const filters = req.query as RateLimitListFilters;
    if (filters.page) filters.page = parseInt(filters.page as any, 10);
    if (filters.limit) filters.limit = parseInt(filters.limit as any, 10);
    console.log(`GET /api/admin/rate-limits - Filters:`, filters);

    try {
      const { data, total } = await this.rateLimitService.listRateLimits(filters);
      res.status(200).json({
        data,
        total,
        page: filters.page || 1,
        limit: filters.limit || 20,
        totalPages: Math.ceil(total / (filters.limit || 20))
      });
    } catch (error: any) {
      console.error(`GET /api/admin/rate-limits - Error:`, error.message);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof DatabaseError) {
        res.status(500).json({ error: 'Failed to retrieve rate limits.' });
      } else {
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }

  async deleteRateLimitById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    console.log(`DELETE /api/admin/rate-limits/${id}`);

    if (!isValidUUID(id)) {
      res.status(400).json({ error: 'Invalid rate limit ID format.' });
      return;
    }
    try {
      const result = await this.rateLimitService.deleteRateLimitById(id);
      if (result) {
        res.status(204).send();
      } else {
        res.status(404).json({ error: 'Rate limit entry not found.' });
      }
    } catch (error: any) {
      console.error(`DELETE /api/admin/rate-limits/${id} - Error:`, error.message);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof DatabaseError) {
        res.status(500).json({ error: 'Failed to delete rate limit entry.' });
      } else {
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }

  async deleteRateLimitsByUserId(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    console.log(`DELETE /api/admin/rate-limits/user/${userId}`);

    if (!isValidUUID(userId)) {
      res.status(400).json({ error: 'Invalid user ID format.' });
      return;
    }
    try {
      await this.rateLimitService.deleteRateLimitsByUserId(userId);
      res.status(204).send();
    } catch (error: any) {
      console.error(`DELETE /api/admin/rate-limits/user/${userId} - Error:`, error.message);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof DatabaseError) {
        res.status(500).json({ error: 'Failed to delete rate limits for user.' });
      } else {
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }
}
